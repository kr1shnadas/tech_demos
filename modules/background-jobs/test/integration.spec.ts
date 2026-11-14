/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { QueueEvents, type Job } from "bullmq";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../demo/api/app.module.js";
import { defineJobsConfig, type JobsConfig } from "../src/config/jobs-config.js";
import type { ImportBatch } from "../src/jobs/import-batch.js";
import type { IngestionJobs, NotificationJobs } from "../src/jobs/queues.js";
import { releaseFeed } from "../src/jobs/sync-feed.js";
import { defineJob, defineQueue } from "../src/queue/contracts.js";
import { RedisIdempotencyStore } from "../src/queue/idempotency.js";
import { bullConnection } from "../src/queue/options.js";
import { JobRuntime, type QueueRegistration } from "../src/queue/runtime.js";
import { queueRegistrations } from "../src/jobs/register.js";
import { startRedis, type RedisProcess } from "./support/redis.js";

const receivedAt = "2026-11-07T08:00:00.000Z";

function batch(batchId: string): ImportBatch {
  return {
    batchId,
    source: "warehouse-east",
    records: [
      { sku: "CAB-14", quantity: 24, receivedAt },
      { sku: "LUG-02", quantity: 6, receivedAt },
      { sku: "BIN-7", quantity: 11, receivedAt },
      { sku: "TRAY", quantity: -3, receivedAt },
    ],
  };
}

describe("queue runtime against redis", () => {
  let redis: RedisProcess;
  let config: JobsConfig;
  let store: RedisIdempotencyStore;
  let runtime: JobRuntime;
  let ingestionEvents: QueueEvents;
  let notificationEvents: QueueEvents;

  beforeAll(async () => {
    redis = await startRedis();
    config = defineJobsConfig({
      redis: { host: redis.host, port: redis.port },
      prefix: `t${process.pid}`.slice(0, 20),
      defaults: {
        attempts: 3,
        backoff: { type: "exponential", delayMs: 40 },
        removeOnComplete: false,
        removeOnFail: false,
      },
      worker: { concurrency: 4, rateLimitMax: 0, rateLimitDurationMs: 1000 },
    });
    store = new RedisIdempotencyStore(config);
    runtime = await JobRuntime.open(config, queueRegistrations(store));
    ingestionEvents = new QueueEvents("ingestion", { connection: bullConnection(config), prefix: config.prefix });
    notificationEvents = new QueueEvents("notification", {
      connection: bullConnection(config),
      prefix: config.prefix,
    });
    await Promise.all([ingestionEvents.waitUntilReady(), notificationEvents.waitUntilReady()]);
  });

  afterAll(async () => {
    await ingestionEvents?.close();
    await notificationEvents?.close();
    await runtime?.close();
    await store?.close();
    await redis?.stop();
  });

  it("imports a batch once when the same id is enqueued twice", async () => {
    const payload = batch("batch-dup-1");
    const producer = runtime.producer<IngestionJobs>("ingestion");
    const first = await producer.add("import-batch", payload, { idempotencyKey: payload.batchId });
    const second = await producer.add("import-batch", payload, { idempotencyKey: payload.batchId });
    expect(second.id).toBe(first.id);
    expect(second.duplicate).toBe(true);
    const result = await finished(runtime, ingestionEvents, "ingestion", first.id);
    expect(result).toMatchObject({ accepted: 3, rejected: 1, duplicate: false });
  });

  it("sends a notice", async () => {
    const queued = await runtime.producer<NotificationJobs>("notification").add(
      "send-notice",
      {
        messageId: "notice-1",
        to: "receiving-desk@example.com",
        subject: "Pallet on the dock",
        body: "CAB-14 is ready for the shelf.",
      },
      { idempotencyKey: "notice-1" },
    );
    const result = await finished(runtime, notificationEvents, "notification", queued.id);
    expect(result).toMatchObject({ delivered: true, duplicate: false });
  });

  it("retries a transient feed until the warehouse accepts it", async () => {
    const queued = await runtime.producer<IngestionJobs>("ingestion").add(
      "sync-feed",
      { feedId: "feed-retry-1", source: "warehouse-east", outcome: "transient", succeedAfter: 3 },
      { idempotencyKey: "feed-retry-1" },
    );
    const result = (await finished(runtime, ingestionEvents, "ingestion", queued.id)) as { attemptsMade: number };
    expect(result.attemptsMade).toBeGreaterThanOrEqual(3);
    const messages = (await runtime.snapshot()).activity.map((entry) => entry.message).join("\n");
    expect(messages).toMatch(/feed-retry-1 failed attempt/);
    expect(messages).toMatch(/Next try in/);
  });

  it("dead-letters a feed that keeps failing, then accepts an operator retry", async () => {
    const queued = await runtime.producer<IngestionJobs>("ingestion").add(
      "sync-feed",
      { feedId: "feed-outage-1", source: "warehouse-east", outcome: "outage", succeedAfter: 3 },
      { idempotencyKey: "feed-outage-1" },
    );
    await expect(finished(runtime, ingestionEvents, "ingestion", queued.id)).rejects.toThrow();
    let letterId = "";
    await waitFor(async () => {
      const letter = (await runtime.snapshot()).deadLetter.find((row) => row.jobId === queued.id);
      if (!letter) return false;
      letterId = letter.id;
      expect(letter.attemptsMade).toBe(3);
      expect(letter.failedReason).toContain("500");
      return true;
    }, 4000);
    await releaseFeed(store, "feed-outage-1");
    const retried = await runtime.retryDeadLetter(letterId);
    const result = await finished(runtime, ingestionEvents, "ingestion", retried.id);
    expect(result).toMatchObject({ accepted: true, duplicate: false });
  });

  it("holds a delayed import until the delay has passed", async () => {
    const payload = batch("batch-delay-1");
    const started = Date.now();
    const queued = await runtime.producer<IngestionJobs>("ingestion").add("import-batch", payload, {
      idempotencyKey: payload.batchId,
      delayMs: 400,
    });
    const job = await runtime.getJob("ingestion", queued.id);
    expect(await job?.getState()).toBe("delayed");
    await finished(runtime, ingestionEvents, "ingestion", queued.id);
    expect(Date.now() - started).toBeGreaterThanOrEqual(350);
  });

  it("dead-letters a bad batch without burning the remaining attempts", async () => {
    const queued = await runtime.producer<IngestionJobs>("ingestion").add("import-batch", {
      batchId: "bad id",
      source: "warehouse-east",
      records: [{ sku: "CAB-14", quantity: 1, receivedAt }],
    });
    await expect(finished(runtime, ingestionEvents, "ingestion", queued.id)).rejects.toThrow(/batchId/);
    const letter = (await runtime.snapshot()).deadLetter.find((row) => row.jobId === queued.id);
    expect(letter?.attemptsMade).toBe(1);
  });

  it("caps how many jobs of one queue run at once", async () => {
    let active = 0;
    let maxSeen = 0;
    const pace = defineQueue("pace", { hold: defineJob<{ ms: number }, { ok: true }>("hold") });
    const paceConfig = defineJobsConfig({
      redis: { host: redis.host, port: redis.port },
      prefix: `p${process.pid}`.slice(0, 20),
      defaults: { attempts: 1, backoff: { delayMs: 0 }, removeOnComplete: false, removeOnFail: false },
      worker: { concurrency: 8, rateLimitMax: 0, rateLimitDurationMs: 1000 },
    });
    const registration: QueueRegistration = {
      spec: pace,
      concurrency: 2,
      rateLimitMax: 0,
      handlers: {
        hold: async () => {
          active += 1;
          maxSeen = Math.max(maxSeen, active);
          await delay(200);
          active -= 1;
          return { ok: true as const };
        },
      },
    };
    const paceRuntime = await JobRuntime.open(paceConfig, [registration]);
    const events = new QueueEvents("pace", { connection: bullConnection(paceConfig), prefix: paceConfig.prefix });
    try {
      await events.waitUntilReady();
      const ids: string[] = [];
      for (let index = 0; index < 6; index += 1) {
        const queued = await paceRuntime.producer<typeof pace.jobs>("pace").add("hold", { ms: 200 });
        ids.push(queued.id);
      }
      await Promise.all(ids.map((id) => finished(paceRuntime, events, "pace", id)));
      expect(maxSeen).toBeGreaterThan(1);
      expect(maxSeen).toBeLessThanOrEqual(2);
    } finally {
      await events.close();
      await paceRuntime.close();
    }
  });

  it("runs a repeatable digest more than once", async () => {
    await runtime.producer<NotificationJobs>("notification").schedule(
      "send-digest",
      { digestId: "digest-repeat-1", to: "receiving-desk@example.com", period: "2026-11-07T11:00" },
      { key: "digest-test", everyMs: 200, limit: 3 },
    );
    await waitFor(async () => {
      const finishedDigest = (await runtime.snapshot()).activity.filter(
        (entry) => entry.kind === "finished" && entry.name === "send-digest",
      );
      return finishedDigest.length >= 2;
    }, 8000);
    await runtime.producer<NotificationJobs>("notification").removeSchedule("digest-test");
  });

  it("answers health and the board over HTTP", async () => {
    const httpConfig = defineJobsConfig({
      redis: { host: redis.host, port: redis.port },
      prefix: `h${process.pid}`.slice(0, 20),
      defaults: {
        attempts: 3,
        backoff: { type: "exponential", delayMs: 20 },
        removeOnComplete: false,
        removeOnFail: false,
      },
      worker: { concurrency: 2, rateLimitMax: 0, rateLimitDurationMs: 1000 },
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(httpConfig)],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication({ logger: false });
    await app.init();
    try {
      const live = await request(app.getHttpServer()).get("/health/live").expect(200);
      expect(live.body).toEqual({ status: "ok" });
      const ready = await request(app.getHttpServer()).get("/health/ready").expect(200);
      expect(ready.body.status).toBe("ok");
      const page = await request(app.getHttpServer()).get("/").expect(200);
      expect(page.text).toContain("Background jobs");
      expect(page.text).toContain("Dead letter");
      const queued = await request(app.getHttpServer()).post("/api/demo/import").send({}).expect(201);
      expect(queued.body.queue).toBe("ingestion");
      await waitFor(async () => {
        const board = await request(app.getHttpServer()).get("/api/board");
        const ingestion = board.body.queues?.find((row: { name: string }) => row.name === "ingestion");
        return board.body.redis === "up" && ingestion?.completed >= 1;
      }, 8000);
    } finally {
      await app.close();
    }
  });

  it("stops taking work after close", async () => {
    await runtime.close();
    await expect(
      runtime.producer<IngestionJobs>("ingestion").add("import-batch", batch("batch-after-close")),
    ).rejects.toThrow();
  });
});

async function finished(runtime: JobRuntime, events: QueueEvents, queueName: string, jobId: string): Promise<unknown> {
  const job = await runtime.getJob(queueName, jobId);
  if (!job) throw new Error(`missing job ${jobId}`);
  return (job as Job).waitUntilFinished(events, 8000);
}

async function waitFor(check: () => Promise<boolean>, timeoutMs: number): Promise<void> {
  const started = Date.now();
  for (;;) {
    if (await check()) return;
    if (Date.now() - started > timeoutMs) throw new Error("timed out waiting for the queue");
    await delay(50);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#test/integration.spec.ts";
