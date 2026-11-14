<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 Krishna Das
See NOTICE at the repository root.
-->

# Background jobs

A receiving desk used to do the slow work inside the request: import the pallet file, mail the desk, push the day's receipts to the central warehouse. When the warehouse blipped, the request failed and the file had to be uploaded again. This module is the queue I put in front of that work. One config object, Redis via BullMQ, retries with backoff, and a dead letter for the jobs that use up their attempts.

## Setup

From this directory, with Node.js 20 or newer and Docker:

```bash
docker compose up --build
```

Open http://localhost:3000.

| Control | What you see |
| --- | --- |
| Import a batch | A receiving file from warehouse-east. Three lines are accepted, one is rejected. |
| Send a notice | A notice for the receiving desk. The demo records it. |
| Sync with retries | The warehouse returns 503 twice, then accepts the feed. |
| Sync that fails | The warehouse keeps returning 500. After the last attempt the job sits in the dead letter. Retry runs it again. |
| Import in 5 seconds | The batch waits in delayed, then runs. |
| Digest every minute | A repeatable notice on a one-minute cron. |

To work on the page without rebuilding the image, start Redis and the process from the repository root:

```bash
docker compose -f modules/background-jobs/docker-compose.yml up -d redis
pnpm install
pnpm --filter @krishnadas/background-jobs dev
```

The page is http://127.0.0.1:3000. `pnpm dev` uses 3 attempts and a 700ms base delay when `JOBS_ATTEMPTS` and `JOBS_BACKOFF_DELAY_MS` are unset, so the retries are visible. Copy `.env.example` to `.env` in this directory when you want the library defaults or a different Redis. Values already set in the environment win over the file.

Tests need `redis-server` on `PATH`. They start their own instance:

```bash
pnpm --filter @krishnadas/background-jobs test
```

Stop the demo with `docker compose down` from this directory.

## Configuration

`defineJobsConfig` merges overrides onto the defaults. Nested objects merge field by field, so setting `defaults.attempts` keeps the backoff. `loadJobsConfig` does the same from the environment.

```ts
import { Module } from "@nestjs/common";
import { defineJobsConfig, JobsModule, queueRegistrations, RedisIdempotencyStore } from "@krishnadas/background-jobs";

const jobsConfig = defineJobsConfig({
  redis: { host: "redis" },
  defaults: { attempts: 5, backoff: { type: "exponential", delayMs: 2000 } },
  worker: { concurrency: 8 },
});

const store = new RedisIdempotencyStore(jobsConfig);

@Module({
  imports: [JobsModule.register({ config: jobsConfig, queues: queueRegistrations(store), closables: [store] })],
})
export class AppModule {}
```

Call `app.enableShutdownHooks()` before `listen`. On SIGTERM the module closes workers first, so the job already running can finish, then closes the queues and the idempotency client.

| Field | Default | Meaning |
| --- | --- | --- |
| `redis.host` | `127.0.0.1` | Redis host |
| `redis.port` | `6379` | Redis port |
| `redis.password` | unset | Optional password |
| `redis.db` | `0` | Redis database index, 0 to 15 |
| `redis.tls` | `false` | Turn on TLS for the Redis connection |
| `prefix` | `bg` | BullMQ key prefix. Workers that share a prefix share the queues |
| `defaults.attempts` | `5` | How many times a job may run |
| `defaults.backoff.type` | `exponential` | `exponential` or `fixed` |
| `defaults.backoff.delayMs` | `2000` | Base delay. Exponential waits grow as `delayMs * 2^(attempt-1)` |
| `defaults.removeOnComplete` | `1000` | Keep this many finished jobs. `true` drops them, `false` keeps them |
| `defaults.removeOnFail` | `5000` | Keep this many failed jobs, so an operator can still retry one |
| `worker.concurrency` | `5` | Jobs of one queue running at once in this process |
| `worker.rateLimitMax` | `50` | Max jobs started per window. `0` turns the limiter off |
| `worker.rateLimitDurationMs` | `1000` | Window for the rate limit |
| `deadLetterQueue` | `dead-letter` | Queue that holds jobs which will not be retried automatically |
| `health.livenessPath` | `/health/live` | Process is up |
| `health.readinessPath` | `/health/ready` | Redis answered. `503` when it did not |

Environment variables: `JOBS_REDIS_HOST`, `JOBS_REDIS_PORT`, `JOBS_REDIS_PASSWORD`, `JOBS_REDIS_DB`, `JOBS_REDIS_TLS`, `JOBS_PREFIX`, `JOBS_ATTEMPTS`, `JOBS_BACKOFF_TYPE`, `JOBS_BACKOFF_DELAY_MS`, `JOBS_REMOVE_ON_COMPLETE`, `JOBS_REMOVE_ON_FAIL`, `JOBS_CONCURRENCY`, `JOBS_RATE_LIMIT_MAX`, `JOBS_RATE_LIMIT_DURATION_MS`, `JOBS_DEAD_LETTER_QUEUE`, `JOBS_LIVENESS_PATH`, `JOBS_READINESS_PATH`.

The demo also reads `PORT` (default `3000`).

`GET /health/live` and `GET /health/ready` come from the module. `GET /` is the desk page. `GET /api/board` is the counts, the dead letter, the failed list and the recent activity. `POST /api/demo/import`, `/notice`, `/sync`, `/digest` and `/retry` enqueue the sample jobs.

## Design

BullMQ sits on Redis and already has the pieces this desk needs: delayed jobs, a repeatable scheduler, per-queue concurrency and a rate limit. A timer inside the web process would lose the file on a crash. A second implementation of leasing and backoff would be the same product, worse. Workers are a separate process from the HTTP handler in the sense that they can be: the demo runs them together, and another deployment can boot the same module with no HTTP routes and the same Redis prefix.

Retries use BullMQ's backoff. Exponential is the default because a warehouse that just returned 503 does not need five more attempts in the same second: the first wait is `delayMs`, the next is double, and so on, until `attempts` is used up. Fixed is there when the gap should stay flat. A payload that cannot succeed, such as a batch id we cannot store, throws an unrecoverable error and skips the remaining attempts.

Idempotency is two layers. The producer takes an idempotency key and stores it as the BullMQ job id, so a second enqueue of the same batch does not create a second job. The handler then writes a completion key in Redis after the work succeeds. If the process dies after the work and before the queue records success, the job runs again. The completion key makes that second run a no-op once the first one finished. The work is still written so a second apply is harmless: the tally is derived from the file, and a notice with the same message id is not recorded twice.

The dead letter is a queue of our own, not a BullMQ feature. When the failed event says the attempt budget is gone, or the error is unrecoverable, the worker copies the payload, the reason and the attempt count onto `dead-letter` and leaves it there. Nothing consumes that queue. Retry deletes the copy and enqueues the original job again. In the demo, the failing sync stays failed until that retry, which is the stand-in for "the outage is over": the retry marks the feed released in Redis, then runs it. A bad batch still fails validation on a retry.

Workers scale by process. Concurrency is how many jobs of one queue this process runs at once. Start more processes with the same Redis, the same prefix and the same handlers, and BullMQ splits the waiting list between them. The rate limit is stored in Redis and shared by those workers, so adding a process does not multiply the cap. Raise concurrency first when the jobs are waiting on this process. Add processes when one machine is out of room. Lower the rate limit when the warehouse, not the CPU, is the constraint.

Shutdown closes the workers before the queues. `worker.close()` waits for the active job, so a SIGTERM during an import does not abandon the file halfway, as long as the orchestrator gives the process time to finish. Liveness only means this process can answer. Readiness pings Redis, and that is what should gate traffic. The Compose healthcheck uses liveness so the app is marked up once it can listen.

## License

Apache-2.0. See [NOTICE](../../NOTICE) at the repository root. Copyright 2026 Krishna Das.
