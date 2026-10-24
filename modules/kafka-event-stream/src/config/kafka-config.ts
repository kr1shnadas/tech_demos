/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export interface TopicSettings {
  /** Topic the outbox relay publishes to. */
  events: string;
  /**
   * Failed attempts land on `{retryPrefix}.1`, `{retryPrefix}.2`, and so on.
   * The last attempt goes to `deadLetter` instead of another retry topic.
   */
  retryPrefix: string;
  deadLetter: string;
}

export interface RetrySettings {
  /** Processing attempts, including the first delivery, before the dead-letter topic. */
  maxAttempts: number;
  /** Wait after the first failure. Later failures multiply it. */
  backoffMs: number;
  multiplier: number;
}

export interface IdempotencySettings {
  /** Postgres table that remembers an event id this consumer group has finished. */
  table: string;
  /** Rows older than this are forgotten, so a redelivery can be applied again. */
  ttlSeconds: number;
}

export interface OutboxSettings {
  table: string;
  pollIntervalMs: number;
  batchSize: number;
}

export interface PostgresSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * One object drives the broker, the outbox and the consumer.
 * Defaults target the Docker Compose demo.
 */
export interface KafkaStreamConfig {
  brokers: readonly string[];
  clientId: string;
  consumerGroup: string;
  topics: TopicSettings;
  /** Partitions on the events topic, the retry topics and the dead-letter topic. */
  partitions: number;
  retry: RetrySettings;
  idempotency: IdempotencySettings;
  outbox: OutboxSettings;
  postgres: PostgresSettings;
}

export interface KafkaConfigOverrides {
  brokers?: readonly string[];
  clientId?: string;
  consumerGroup?: string;
  topics?: Partial<TopicSettings>;
  partitions?: number;
  retry?: Partial<RetrySettings>;
  idempotency?: Partial<IdempotencySettings>;
  outbox?: Partial<OutboxSettings>;
  postgres?: Partial<PostgresSettings>;
}

export const defaultKafkaConfig: KafkaStreamConfig = Object.freeze({
  brokers: Object.freeze(["localhost:9092"]),
  clientId: "kafka-event-stream",
  consumerGroup: "study-ingestion",
  topics: Object.freeze({
    events: "study.ingestion",
    retryPrefix: "study.ingestion.retry",
    deadLetter: "study.ingestion.dlt",
  }),
  partitions: 3,
  retry: Object.freeze({
    maxAttempts: 3,
    backoffMs: 1000,
    multiplier: 2,
  }),
  idempotency: Object.freeze({
    table: "processed_events",
    ttlSeconds: 86_400,
  }),
  outbox: Object.freeze({
    table: "outbox",
    pollIntervalMs: 500,
    batchSize: 50,
  }),
  postgres: Object.freeze({
    host: "localhost",
    port: 5432,
    user: "events",
    password: "events",
    database: "events",
  }),
});

export function retryTopicName(config: Pick<KafkaStreamConfig, "topics">, failedAttempt: number): string {
  return `${config.topics.retryPrefix}.${failedAttempt}`;
}

/** Retry topics for attempts `1 .. maxAttempts-1`. The last attempt uses the dead-letter topic. */
export function retryTopicNames(config: Pick<KafkaStreamConfig, "topics" | "retry">): string[] {
  const names: string[] = [];
  for (let attempt = 1; attempt < config.retry.maxAttempts; attempt += 1) {
    names.push(retryTopicName(config, attempt));
  }
  return names;
}

export function allStreamTopics(config: KafkaStreamConfig): string[] {
  return [config.topics.events, ...retryTopicNames(config), config.topics.deadLetter];
}

export function defineKafkaConfig(overrides: KafkaConfigOverrides = {}): KafkaStreamConfig {
  const merged: KafkaStreamConfig = {
    brokers: overrides.brokers ? [...overrides.brokers] : [...defaultKafkaConfig.brokers],
    clientId: overrides.clientId ?? defaultKafkaConfig.clientId,
    consumerGroup: overrides.consumerGroup ?? defaultKafkaConfig.consumerGroup,
    topics: { ...defaultKafkaConfig.topics, ...defined(overrides.topics ?? {}) },
    partitions: overrides.partitions ?? defaultKafkaConfig.partitions,
    retry: { ...defaultKafkaConfig.retry, ...defined(overrides.retry ?? {}) },
    idempotency: { ...defaultKafkaConfig.idempotency, ...defined(overrides.idempotency ?? {}) },
    outbox: { ...defaultKafkaConfig.outbox, ...defined(overrides.outbox ?? {}) },
    postgres: { ...defaultKafkaConfig.postgres, ...defined(overrides.postgres ?? {}) },
  };
  assertKafkaConfig(merged);
  return merged;
}

export function assertSqlIdentifier(value: string, label: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error(`${label} must be a lowercase SQL identifier.`);
  }
  return value;
}

function assertKafkaConfig(config: KafkaStreamConfig): void {
  if (config.brokers.length === 0) {
    throw new Error("brokers must list at least one host:port.");
  }
  for (const broker of config.brokers) {
    if (!/^[A-Za-z0-9._-]+:\d+$/.test(broker)) {
      throw new Error(`broker "${broker}" must look like host:port.`);
    }
  }
  if (!config.clientId.trim()) throw new Error("clientId is required.");
  if (!config.consumerGroup.trim()) throw new Error("consumerGroup is required.");
  assertTopicName(config.topics.events, "topics.events");
  assertTopicName(config.topics.retryPrefix, "topics.retryPrefix");
  assertTopicName(config.topics.deadLetter, "topics.deadLetter");
  if (!Number.isInteger(config.partitions) || config.partitions < 1 || config.partitions > 50) {
    throw new Error("partitions must be an integer from 1 to 50.");
  }
  if (!Number.isInteger(config.retry.maxAttempts) || config.retry.maxAttempts < 1 || config.retry.maxAttempts > 20) {
    throw new Error("retry.maxAttempts must be an integer from 1 to 20.");
  }
  if (!Number.isFinite(config.retry.backoffMs) || config.retry.backoffMs < 0) {
    throw new Error("retry.backoffMs must be a non-negative number.");
  }
  if (!Number.isFinite(config.retry.multiplier) || config.retry.multiplier < 1) {
    throw new Error("retry.multiplier must be a number of at least 1.");
  }
  assertSqlIdentifier(config.idempotency.table, "idempotency.table");
  if (!Number.isInteger(config.idempotency.ttlSeconds) || config.idempotency.ttlSeconds < 0) {
    throw new Error("idempotency.ttlSeconds must be a non-negative integer.");
  }
  assertSqlIdentifier(config.outbox.table, "outbox.table");
  if (!Number.isInteger(config.outbox.pollIntervalMs) || config.outbox.pollIntervalMs < 50) {
    throw new Error("outbox.pollIntervalMs must be an integer of at least 50.");
  }
  if (!Number.isInteger(config.outbox.batchSize) || config.outbox.batchSize < 1 || config.outbox.batchSize > 500) {
    throw new Error("outbox.batchSize must be an integer from 1 to 500.");
  }
  if (!config.postgres.host.trim()) throw new Error("postgres.host is required.");
  if (!Number.isInteger(config.postgres.port) || config.postgres.port < 1 || config.postgres.port > 65535) {
    throw new Error("postgres.port must be an integer from 1 to 65535.");
  }
  if (!config.postgres.user.trim()) throw new Error("postgres.user is required.");
  if (!config.postgres.database.trim()) throw new Error("postgres.database is required.");
  const names = allStreamTopics(config);
  if (new Set(names).size !== names.length) {
    throw new Error("topic names must be distinct.");
  }
}

function assertTopicName(value: string, label: string): void {
  if (!/^[A-Za-z0-9._-]{1,200}$/.test(value)) {
    throw new Error(`${label} must be a Kafka topic name.`);
  }
}

function defined<T extends object>(overrides: T): Partial<T> {
  return Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)) as Partial<T>;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#src/config/kafka-config.ts";
