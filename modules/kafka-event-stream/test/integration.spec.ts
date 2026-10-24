/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { Kafka, logLevel } from "kafkajs";
import { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { defineKafkaConfig, type KafkaStreamConfig, type PostgresSettings } from "../src/config/kafka-config.js";
import { schemaSql } from "../src/db/schema.js";
import { AppModule } from "../demo/api/app.module.js";
import { ConsumerService } from "../src/nest/consumer.service.js";
import { ProducerService } from "../src/nest/producer.service.js";
import { StreamContext } from "../src/nest/stream-context.js";
import { decodeRecord, type StreamRecord } from "../src/pipeline/message.js";
import { enqueueInTransaction } from "../src/pipeline/outbox.js";
import { handleRecord } from "../src/pipeline/process.js";
import { startInfra, type Infra } from "./support/infra.js";

describe("kafka pipeline", () => {
  let infra: Infra;
  let pool: Pool;

  beforeAll(async () => {
    infra = await startInfra();
    infraRef = infra;
    pool = new Pool(infra.postgres);
    pool.on("error", () => undefined);
    await pool.query(schemaSql(defineKafkaConfig({ postgres: infra.postgres })));
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await infra?.stop();
  });

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        held_events,
        key_gates,
        delivery_routes,
        dead_letters,
        applied_events,
        processed_events,
        outbox,
        partition_sequences
      RESTART IDENTITY
    `);
  });

  it("publishes a committed outbox row and drops a rolled-back one", async () => {
    const config = scenario("outbox-publish");
    const pipeline = await boot(config);
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await enqueueInTransaction(client, config, {
          partitionKey: "batch-14",
          eventType: "ingestion.accepted",
          payload: { poison: false, recordId: "rolled-back" },
        });
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
      expect(await count(pool, "outbox")).toBe(0);

      const first = await pipeline.producer.enqueue(good("batch-14", "row-1"));
      const second = await pipeline.producer.enqueue(good("batch-14", "row-2"));
      const third = await pipeline.producer.enqueue(good("batch-14", "row-3"));
      expect([first.sequence, second.sequence, third.sequence]).toEqual([1, 2, 3]);

      await waitFor("outbox publish", async () => (await unpublished(pool)) === 0);
      const records = await readTopic(config, config.topics.events, 3);
      expect(records.map((record) => record.key)).toEqual(["batch-14", "batch-14", "batch-14"]);
      expect(records.map((record) => record.record.sequence)).toEqual([1, 2, 3]);
    } finally {
      await pipeline.stop();
    }
  }, 40_000);

  it("applies a re-delivered event once", async () => {
    const config = scenario("idempotent");
    const pipeline = await boot(config);
    try {
      const record = await pipeline.producer.enqueue(good("batch-14", "row-1"));
      await waitFor("applied", async () => (await count(pool, "applied_events")) === 1);
      const again = await handleRecord(deps(pipeline), record, 1);
      expect(again).toBe("duplicate");

      await pipeline.context.producer.send({
        topic: config.topics.events,
        messages: [{ key: record.partitionKey, value: JSON.stringify(record), headers: { "x-attempt": "1" } }],
      });
      await waitFor("consumer caught up", async () => {
        const status = await pipeline.consumer.status();
        return status.lag.total === 0 && status.outbox.published >= 1;
      });
      expect(await count(pool, "applied_events")).toBe(1);
    } finally {
      await pipeline.stop();
    }
  }, 40_000);

  it("retries a poison event, dead-letters it, and keeps later records for that key behind it", async () => {
    const config = scenario("poison-order");
    const pipeline = await boot(config);
    try {
      const poison = await pipeline.producer.enqueue({
        partitionKey: "batch-14",
        eventType: "ingestion.poison",
        payload: { poison: true, recordId: "bad-row" },
      });
      await pipeline.producer.enqueue(good("batch-14", "after-1"));
      await pipeline.producer.enqueue(good("batch-14", "after-2"));

      await waitFor("dead letter and held records", async () => {
        return (await count(pool, "dead_letters")) === 1 && (await count(pool, "applied_events")) === 2;
      });

      const dead = await pool.query<{ attempts: number; event_id: string; failed_at: Date }>(
        `SELECT attempts, event_id, failed_at FROM dead_letters`,
      );
      expect(dead.rows[0]?.event_id).toBe(poison.eventId);
      expect(dead.rows[0]?.attempts).toBe(3);

      const routes = await pool.query<{ attempt: number; destination: string }>(
        `SELECT attempt, destination FROM delivery_routes WHERE event_id = $1 ORDER BY attempt`,
        [poison.eventId],
      );
      expect(routes.rows.map((row) => row.destination)).toEqual([
        `${config.topics.retryPrefix}.1`,
        `${config.topics.retryPrefix}.2`,
        config.topics.deadLetter,
      ]);

      const applied = await pool.query<{ sequence: string; applied_at: Date }>(
        `SELECT sequence, applied_at FROM applied_events ORDER BY position`,
      );
      expect(applied.rows.map((row) => Number(row.sequence))).toEqual([2, 3]);
      const failedAt = dead.rows[0]?.failed_at?.getTime() ?? 0;
      for (const row of applied.rows) {
        expect(row.applied_at.getTime()).toBeGreaterThanOrEqual(failedAt);
      }

      const deadRecords = await readTopic(config, config.topics.deadLetter, 1);
      expect(deadRecords[0]?.record.eventId).toBe(poison.eventId);
      expect(deadRecords[0]?.key).toBe("batch-14");
    } finally {
      await pipeline.stop();
    }
  }, 40_000);

  it("replays from an offset without applying a finished event twice", async () => {
    const config = scenario("replay");
    const pipeline = await boot(config);
    try {
      const first = await pipeline.producer.enqueue(good("batch-14", "row-1"));
      const second = await pipeline.producer.enqueue(good("batch-14", "row-2"));
      await waitFor("both applied", async () => (await count(pool, "applied_events")) === 2);

      const replayed = await pipeline.consumer.replay({ offset: "0", partition: 0, limit: 20 });
      expect(replayed.read).toBeGreaterThanOrEqual(2);
      expect(replayed.duplicates).toBeGreaterThanOrEqual(2);
      expect(replayed.applied).toBe(0);
      expect(await count(pool, "applied_events")).toBe(2);

      await pool.query(`DELETE FROM processed_events WHERE event_id = $1`, [first.eventId]);
      await pool.query(`DELETE FROM applied_events WHERE event_id = $1`, [first.eventId]);
      const secondPass = await pipeline.consumer.replay({ offset: "0", partition: 0, limit: 20 });
      expect(secondPass.hits.filter((hit) => hit.eventId === first.eventId).map((hit) => hit.outcome)).toContain(
        "applied",
      );
      expect(secondPass.hits.filter((hit) => hit.eventId === second.eventId).every((hit) => hit.outcome === "duplicate")).toBe(
        true,
      );
      expect(await count(pool, "applied_events")).toBe(2);
    } finally {
      await pipeline.stop();
    }
  }, 40_000);

  it("accepts an event through the HTTP API", async () => {
    const config = scenario("http-api");
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(config)],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication({ logger: false });
    await app.init();
    try {
      await request(app.getHttpServer())
        .post("/api/events")
        .send({ kind: "good", partitionKey: "batch-14" })
        .expect(201);
      await waitFor("http event applied", async () => (await count(pool, "applied_events")) === 1);
      const status = await request(app.getHttpServer()).get("/api/status").expect(200);
      expect(status.body.events).toHaveLength(1);
      expect(status.body.lag.total).toBe(0);
      expect(status.body.deadLetters).toEqual([]);
    } finally {
      await app.close();
    }
  }, 40_000);
});

function scenario(name: string): KafkaStreamConfig {
  return defineKafkaConfig({
    brokers: infraBrokers(),
    clientId: name,
    consumerGroup: `${name}-group`,
    partitions: 1,
    topics: {
      events: `${name}.events`,
      retryPrefix: `${name}.retry`,
      deadLetter: `${name}.dlt`,
    },
    retry: { maxAttempts: 3, backoffMs: 40, multiplier: 2 },
    outbox: { pollIntervalMs: 100, batchSize: 20 },
    idempotency: { ttlSeconds: 86_400 },
    postgres: infraPostgres(),
  });
}

let infraRef: Infra | undefined;

function infraBrokers(): string[] {
  if (!infraRef) throw new Error("infra is not started.");
  return infraRef.brokers;
}

function infraPostgres(): PostgresSettings {
  if (!infraRef) throw new Error("infra is not started.");
  return infraRef.postgres;
}

interface Pipeline {
  context: StreamContext;
  producer: ProducerService;
  consumer: ConsumerService;
  stop: () => Promise<void>;
}

async function boot(config: KafkaStreamConfig): Promise<Pipeline> {
  const context = new StreamContext(config);
  await context.start();
  const producer = new ProducerService(context);
  const consumer = new ConsumerService(context);
  await consumer.start();
  producer.startRelay();
  return {
    context,
    producer,
    consumer,
    stop: async () => {
      producer.stopRelay();
      await consumer.stop();
      await context.stop();
    },
  };
}

function deps(pipeline: Pipeline) {
  return { pool: pipeline.context.pool, producer: pipeline.context.producer, config: pipeline.context.config };
}

function good(partitionKey: string, recordId: string) {
  return {
    partitionKey,
    eventType: "ingestion.accepted",
    payload: { poison: false, recordId, source: "batch-file" },
  };
}

async function count(pool: Pool, table: string): Promise<number> {
  const result = await pool.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${table}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function unpublished(pool: Pool): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM outbox WHERE published_at IS NULL`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function readTopic(
  config: KafkaStreamConfig,
  topic: string,
  expected: number,
): Promise<Array<{ key: string | null; record: StreamRecord }>> {
  const kafka = new Kafka({ clientId: `${config.clientId}-read`, brokers: [...config.brokers], logLevel: logLevel.NOTHING });
  const consumer = kafka.consumer({ groupId: `${config.clientId}-read-${Date.now()}` });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });
  const found: Array<{ key: string | null; record: StreamRecord }> = [];
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  const timer = setTimeout(() => resolveDone(), 8_000);
  const running = consumer.run({
    eachMessage: async ({ message }) => {
      found.push({
        key: message.key ? message.key.toString() : null,
        record: decodeRecord(message.value),
      });
      if (found.length >= expected) {
        clearTimeout(timer);
        resolveDone();
      }
    },
  });
  try {
    await done;
  } finally {
    clearTimeout(timer);
    await consumer.disconnect().catch(() => undefined);
    await running.catch(() => undefined);
  }
  return found;
}

async function waitFor(label: string, check: () => Promise<boolean>, timeoutMs = 20_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${label}`);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#test/integration.spec.ts";
