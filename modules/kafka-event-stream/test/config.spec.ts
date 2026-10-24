/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { describe, expect, it } from "vitest";
import { defaultKafkaConfig, defineKafkaConfig, retryTopicNames } from "../src/config/kafka-config.js";
import { loadKafkaConfig } from "../src/config/load-config.js";

describe("kafka config", () => {
  it("starts from the local demo defaults", () => {
    const config = defineKafkaConfig();
    expect(config.brokers).toEqual(["localhost:9092"]);
    expect(config.consumerGroup).toBe("study-ingestion");
    expect(config.topics.deadLetter).toBe("study.ingestion.dlt");
    expect(config.retry).toEqual(defaultKafkaConfig.retry);
    expect(config.idempotency.table).toBe("processed_events");
    expect(config.idempotency.ttlSeconds).toBe(86400);
    expect(config.outbox.pollIntervalMs).toBe(500);
    expect(config.postgres.database).toBe("events");
  });

  it("merges a nested override without dropping the other fields", () => {
    const config = defineKafkaConfig({
      retry: { backoffMs: 50 },
      topics: { events: "batch.events" },
    });
    expect(config.retry).toEqual({ maxAttempts: 3, backoffMs: 50, multiplier: 2 });
    expect(config.topics.events).toBe("batch.events");
    expect(config.topics.deadLetter).toBe(defaultKafkaConfig.topics.deadLetter);
    expect(retryTopicNames(config)).toEqual(["study.ingestion.retry.1", "study.ingestion.retry.2"]);
  });

  it("reads the environment", () => {
    const config = loadKafkaConfig({
      KAFKA_BROKERS: "broker-a:9092, broker-b:9092",
      KAFKA_CONSUMER_GROUP: "nightly",
      KAFKA_RETRY_MAX_ATTEMPTS: "5",
      KAFKA_RETRY_MULTIPLIER: "1.5",
      KAFKA_IDEMPOTENCY_TTL_SECONDS: "60",
      KAFKA_OUTBOX_BATCH_SIZE: "10",
      POSTGRES_HOST: "db",
      POSTGRES_PORT: "5433",
    });
    expect(config.brokers).toEqual(["broker-a:9092", "broker-b:9092"]);
    expect(config.consumerGroup).toBe("nightly");
    expect(config.retry.maxAttempts).toBe(5);
    expect(config.retry.multiplier).toBe(1.5);
    expect(config.retry.backoffMs).toBe(defaultKafkaConfig.retry.backoffMs);
    expect(config.idempotency.ttlSeconds).toBe(60);
    expect(config.outbox.batchSize).toBe(10);
    expect(config.postgres.host).toBe("db");
    expect(config.postgres.port).toBe(5433);
    expect(config.postgres.user).toBe("events");
  });

  it("rejects a table name that is not an identifier", () => {
    expect(() => defineKafkaConfig({ idempotency: { table: "processed events" } })).toThrow(
      /lowercase SQL identifier/,
    );
  });

  it("rejects an empty broker list", () => {
    expect(() => defineKafkaConfig({ brokers: [] })).toThrow(/at least one host:port/);
  });
});

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#test/config.spec.ts";
