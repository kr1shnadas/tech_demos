<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 Krishna Das
See NOTICE at the repository root.
-->

# Kafka event streaming

Batch ingestion is where I kept losing the hand-off. The row was committed in Postgres, and a second call was supposed to tell the rest of the pipeline. When the process died between the two, the row existed and nobody downstream heard about it. This module is that slice: the event is written in the same transaction as the outbox, a relay publishes it to Kafka, and the consumer can see a copy twice without applying it twice.

## Setup

From this directory, with Node.js 20 or newer and Docker:

```bash
docker compose up --build
```

Open http://localhost:3000.

| Control | What you see |
| --- | --- |
| Send a good event | The event shows up under Events. The partition key is the Kafka message key. |
| Send a poison event | It fails, shows up under Retries, then moves to Dead letter. |
| Replay from offset 0 | The log is read again. Events already applied come back as duplicates. |

The page polls the API. Events are the records the consumer applied. Consumer lag is the events topic: log end offset minus the group commit, per partition. Dead letter is the queue of records that used up their attempts.

Postgres listens on localhost:5432 (`events` / `events`, database `events`). Kafka listens on localhost:9092 for clients on the host. The API container uses `kafka:29092`, the listener advertised inside the Compose network. The broker is a single KRaft node. The compose file does not start ZooKeeper.

To work on the page without rebuilding the image, leave Postgres and Kafka up and run the two processes from the repository root:

```bash
docker compose -f modules/kafka-event-stream/docker-compose.yml up -d postgres kafka
pnpm install
pnpm --filter @krishnadas/kafka-event-stream dev
```

| Process | URL |
| --- | --- |
| API | http://localhost:3000 |
| React status page | http://127.0.0.1:5173 |

The page proxies `/api` to the API. Copy `.env.example` to `.env` in this directory when you want different brokers or a different database. Values already set in the environment win over the file.

Tests, from the repository root:

```bash
pnpm --filter @krishnadas/kafka-event-stream test
```

The integration tests start their own Postgres and a KRaft broker. They do not use the Compose ports.

Stop the demo with `docker compose down` from this directory.

## Usage

The package name is `@krishnadas/kafka-event-stream`. It is a private workspace package, so it is not on a public registry. In another package in this repository, depend on it and install from the root:

```json
{
  "dependencies": {
    "@krishnadas/kafka-event-stream": "workspace:*"
  }
}
```

```bash
pnpm install
```

Node.js 20 or newer, plus Postgres and a Kafka broker. The export map points at `src/index.ts`, so the project that imports it has to compile that TypeScript. The demo uses `tsx`.

To use the module in a different repository, copy `modules/kafka-event-stream` and point the dependency at that folder (`workspace:*` or `file:`). Keep the license header on the copied files, and keep the repository [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE) with the copy.

Import from `@krishnadas/kafka-event-stream`. `defineKafkaConfig` merges overrides onto the defaults. Nested objects merge field by field, so setting `retry.backoffMs` keeps the other retry fields. `loadKafkaConfig()` does the same from the environment, and reads a `.env` file in the working directory when one is present. Values already set in the environment win over that file.

`KafkaStreamModule.register(config)` starts the pool, the producer, the consumer and the outbox relay when the Nest module initializes, and stops them on destroy. Inject `ProducerService` to write an outbox row. Inject `ConsumerService` for `status()` and `replay({ offset, partition, limit })`. `offset` is a decimal string. `partition` and `limit` are optional.

`ProducerService.enqueue` opens its own transaction and inserts only the outbox row. When the event has to commit with a business write, call `enqueueInTransaction(client, config, input)` on that same `PoolClient` instead. A rollback then drops the outbox row with the business row.

```ts
import { Inject, Injectable, Module } from "@nestjs/common";
import {
  KafkaStreamModule,
  ProducerService,
  defineKafkaConfig,
} from "@krishnadas/kafka-event-stream";

const streamConfig = defineKafkaConfig({
  brokers: ["localhost:9092"],
  consumerGroup: "study-ingestion",
  retry: { maxAttempts: 3, backoffMs: 1000, multiplier: 2 },
});

@Injectable()
export class IngestionService {
  constructor(@Inject(ProducerService) private readonly producer: ProducerService) {}

  accept(batchId: string) {
    return this.producer.enqueue({
      partitionKey: batchId,
      eventType: "ingestion.accepted",
      payload: { batchId },
    });
  }
}

@Module({
  imports: [KafkaStreamModule.register(streamConfig)],
  providers: [IngestionService],
})
export class AppModule {}
```

`EnqueueInput` is `{ partitionKey: string, eventType: string, payload: Record<string, unknown>, eventId?: string }`. `eventId` defaults to a new UUID. The partition key becomes the Kafka message key. I use the batch id.

The consumer is `handleRecord`. It does not take a handler you register. A record with `payload.poison === true`, or the event type `ingestion.poison`, is retried and then written to the dead-letter topic. Every other record is inserted into `applied_events` once for that event id and consumer group.

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `brokers` | `readonly string[]` | `["localhost:9092"]` | Bootstrap servers, each `host:port` |
| `clientId` | `string` | `kafka-event-stream` | Kafka client id |
| `consumerGroup` | `string` | `study-ingestion` | Group that commits offsets on the events topic |
| `topics.events` | `string` | `study.ingestion` | Topic the relay publishes to |
| `topics.retryPrefix` | `string` | `study.ingestion.retry` | Failed attempt *n* is published to `{prefix}.{n}` |
| `topics.deadLetter` | `string` | `study.ingestion.dlt` | Topic for a record that has used its attempts |
| `partitions` | `number` | `3` | Partitions on the events topic, each retry topic and the dead-letter topic |
| `retry.maxAttempts` | `number` | `3` | Attempts including the first delivery. The last failure is dead-lettered |
| `retry.backoffMs` | `number` | `1000` | Wait after the first failure |
| `retry.multiplier` | `number` | `2` | Each later failure multiplies the wait |
| `idempotency.table` | `string` | `processed_events` | Table of event ids this group has finished |
| `idempotency.ttlSeconds` | `number` | `86400` | After this, a redelivery can be applied again |
| `outbox.table` | `string` | `outbox` | Table the relay reads |
| `outbox.pollIntervalMs` | `number` | `500` | How often the relay looks for unpublished rows |
| `outbox.batchSize` | `number` | `50` | Rows published in one poll |
| `postgres.host` | `string` | `localhost` | Database host |
| `postgres.port` | `number` | `5432` | Database port |
| `postgres.user` | `string` | `events` | Database user |
| `postgres.password` | `string` | `events` | Database password. This is the local demo password |
| `postgres.database` | `string` | `events` | Database name |

Environment variables: `KAFKA_BROKERS` (comma-separated), `KAFKA_CLIENT_ID`, `KAFKA_CONSUMER_GROUP`, `KAFKA_TOPIC_EVENTS`, `KAFKA_TOPIC_RETRY_PREFIX`, `KAFKA_TOPIC_DEAD_LETTER`, `KAFKA_PARTITIONS`, `KAFKA_RETRY_MAX_ATTEMPTS`, `KAFKA_RETRY_BACKOFF_MS`, `KAFKA_RETRY_MULTIPLIER`, `KAFKA_IDEMPOTENCY_TABLE`, `KAFKA_IDEMPOTENCY_TTL_SECONDS`, `KAFKA_OUTBOX_TABLE`, `KAFKA_OUTBOX_POLL_MS`, `KAFKA_OUTBOX_BATCH_SIZE`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`.

The Compose file sets `KAFKA_RETRY_BACKOFF_MS=400` so a poison event reaches the dead-letter queue while you are still looking at the page. The code default stays at one second.

## Design

The outbox exists because the database commit and the message have to agree. `enqueue` takes the next sequence for that partition key and inserts the outbox row in the caller's transaction. Roll the transaction back and the relay has nothing to publish. Commit it and the row is the source of truth until the broker accepts the record. The relay then sets `published_at`. If it dies after the broker accepts the record and before that update, it publishes the same row again. That is the duplicate the consumer is built for.

Delivery is at least once. I do not try to make the broker and Postgres commit atomically. The idempotency table is the other half: the event id and the consumer group are inserted in the same transaction as the side effect. A redelivery finds the row and does not apply the event again. The row expires after `idempotency.ttlSeconds`. I keep that long enough to cover a relay retry, and short enough that a deliberate replay days later can be applied again if I delete the row or let it expire. A dead-lettered id is stored the same way, so a replay does not walk it back onto the retry topics unless the row is gone.

Ordering follows the partition key. The relay sends with that key, and the partitioner keeps one key on one partition, in the order the rows were committed. The consumer handles a partition one record at a time. When a record fails, I put a gate on its key and publish it to the next retry topic with the same key. A newer record for that key is parked in Postgres instead of being applied. When the failed record is applied or dead-lettered, the parked records run in sequence order. A different key is not parked, including one that happens to share the partition. The retry wait happens on the retry topic, so the failed record does not sit uncommitted on the events partition and block every other key there.

With `maxAttempts` of 3 the record is tried on the events topic, then `retryPrefix.1`, then `retryPrefix.2`. The third failure is published to the dead-letter topic and the gate opens. The wait is `backoffMs` after the first failure and `backoffMs * multiplier` after the second. The Compose demo uses a short wait so the dead letter shows up on the page. A poison payload is the failure I use here. A handler that throws would take the same path.

Replay does not move the group offset. It starts a second consumer from the beginning of the partition and runs the same handler for every record at or after the offset you pass. Records before that offset are left alone. `POST /api/replay` with `{ "offset": "0", "partition": 0 }` is what the button calls. Finished ids come back as duplicates, which is what I want when I am checking a stretch of the log. To apply one again I delete its idempotency row first. The offset is per partition. Partition 0 offset 0 is the start of that partition, not a global position across the topic.

## Credit / attribution

This module is authored by Krishna Das ([github.com/kr1shnadas](https://github.com/kr1shnadas)).

Anyone who uses it must give credit to Krishna Das. That covers calling it from your own service and shipping a copy or a derivative. Keep the Apache-2.0 license header on the source files (`SPDX-License-Identifier: Apache-2.0` and `Copyright 2026 Krishna Das`). Keep the repository [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE) intact. Section 4(d) of the Apache License 2.0 is why the NOTICE stays: a redistribution or a derivative work has to retain that file and give visible credit to Krishna Das, in the source, in the documentation that goes with it, or on a display the work normally shows.

The license remains Apache-2.0. This section does not change it.
