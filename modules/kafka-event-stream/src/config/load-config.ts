/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { existsSync, readFileSync } from "node:fs";
import {
  defineKafkaConfig,
  type KafkaConfigOverrides,
  type KafkaStreamConfig,
} from "./kafka-config.js";

/**
 * Builds the config from the environment.
 * Unset variables keep the defaults in `defineKafkaConfig`.
 * When this reads `process.env` and a `.env` file is present, values already
 * set in the environment win.
 */
export function loadKafkaConfig(env: NodeJS.ProcessEnv = process.env): KafkaStreamConfig {
  if (env === process.env) loadEnvFile();
  const overrides: KafkaConfigOverrides = {};

  if (present(env.KAFKA_BROKERS)) {
    overrides.brokers = env.KAFKA_BROKERS.split(",").map((broker) => broker.trim()).filter(Boolean);
  }
  if (present(env.KAFKA_CLIENT_ID)) overrides.clientId = env.KAFKA_CLIENT_ID.trim();
  if (present(env.KAFKA_CONSUMER_GROUP)) overrides.consumerGroup = env.KAFKA_CONSUMER_GROUP.trim();

  const topics: NonNullable<KafkaConfigOverrides["topics"]> = {};
  if (present(env.KAFKA_TOPIC_EVENTS)) topics.events = env.KAFKA_TOPIC_EVENTS.trim();
  if (present(env.KAFKA_TOPIC_RETRY_PREFIX)) topics.retryPrefix = env.KAFKA_TOPIC_RETRY_PREFIX.trim();
  if (present(env.KAFKA_TOPIC_DEAD_LETTER)) topics.deadLetter = env.KAFKA_TOPIC_DEAD_LETTER.trim();
  if (Object.keys(topics).length > 0) overrides.topics = topics;

  if (present(env.KAFKA_PARTITIONS)) overrides.partitions = readInt("KAFKA_PARTITIONS", env.KAFKA_PARTITIONS);

  const retry: NonNullable<KafkaConfigOverrides["retry"]> = {};
  if (present(env.KAFKA_RETRY_MAX_ATTEMPTS)) {
    retry.maxAttempts = readInt("KAFKA_RETRY_MAX_ATTEMPTS", env.KAFKA_RETRY_MAX_ATTEMPTS);
  }
  if (present(env.KAFKA_RETRY_BACKOFF_MS)) {
    retry.backoffMs = readInt("KAFKA_RETRY_BACKOFF_MS", env.KAFKA_RETRY_BACKOFF_MS);
  }
  if (present(env.KAFKA_RETRY_MULTIPLIER)) {
    retry.multiplier = readNumber("KAFKA_RETRY_MULTIPLIER", env.KAFKA_RETRY_MULTIPLIER);
  }
  if (Object.keys(retry).length > 0) overrides.retry = retry;

  const idempotency: NonNullable<KafkaConfigOverrides["idempotency"]> = {};
  if (present(env.KAFKA_IDEMPOTENCY_TABLE)) idempotency.table = env.KAFKA_IDEMPOTENCY_TABLE.trim();
  if (present(env.KAFKA_IDEMPOTENCY_TTL_SECONDS)) {
    idempotency.ttlSeconds = readInt("KAFKA_IDEMPOTENCY_TTL_SECONDS", env.KAFKA_IDEMPOTENCY_TTL_SECONDS);
  }
  if (Object.keys(idempotency).length > 0) overrides.idempotency = idempotency;

  const outbox: NonNullable<KafkaConfigOverrides["outbox"]> = {};
  if (present(env.KAFKA_OUTBOX_TABLE)) outbox.table = env.KAFKA_OUTBOX_TABLE.trim();
  if (present(env.KAFKA_OUTBOX_POLL_MS)) outbox.pollIntervalMs = readInt("KAFKA_OUTBOX_POLL_MS", env.KAFKA_OUTBOX_POLL_MS);
  if (present(env.KAFKA_OUTBOX_BATCH_SIZE)) {
    outbox.batchSize = readInt("KAFKA_OUTBOX_BATCH_SIZE", env.KAFKA_OUTBOX_BATCH_SIZE);
  }
  if (Object.keys(outbox).length > 0) overrides.outbox = outbox;

  const postgres: NonNullable<KafkaConfigOverrides["postgres"]> = {};
  if (present(env.POSTGRES_HOST)) postgres.host = env.POSTGRES_HOST.trim();
  if (present(env.POSTGRES_PORT)) postgres.port = readInt("POSTGRES_PORT", env.POSTGRES_PORT);
  if (present(env.POSTGRES_USER)) postgres.user = env.POSTGRES_USER.trim();
  if (present(env.POSTGRES_PASSWORD)) postgres.password = env.POSTGRES_PASSWORD;
  if (present(env.POSTGRES_DATABASE)) postgres.database = env.POSTGRES_DATABASE.trim();
  if (Object.keys(postgres).length > 0) overrides.postgres = postgres;

  return defineKafkaConfig(overrides);
}

export function loadEnvFile(path = ".env"): void {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim());
}

function readNumber(name: string, raw: string): number {
  const value = Number(raw.trim());
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number.`);
  return value;
}

function readInt(name: string, raw: string): number {
  const value = readNumber(name, raw);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer.`);
  return value;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#src/config/load-config.ts";
