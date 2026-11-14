/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export type BackoffType = "exponential" | "fixed";

export interface RedisSettings {
  host: string;
  port: number;
  password?: string;
  db: number;
  tls: boolean;
}

export interface BackoffSettings {
  type: BackoffType;
  /** Base delay in milliseconds. Exponential waits grow as delayMs * 2^(attempt-1). */
  delayMs: number;
}

export interface JobDefaults {
  attempts: number;
  backoff: BackoffSettings;
  /** `true` drops the job, `false` keeps it, a number keeps that many newest jobs. */
  removeOnComplete: number | boolean;
  removeOnFail: number | boolean;
}

export interface WorkerSettings {
  concurrency: number;
  /** `0` turns the rate limiter off. */
  rateLimitMax: number;
  rateLimitDurationMs: number;
}

export interface HealthPaths {
  livenessPath: string;
  readinessPath: string;
}

/**
 * One object drives the Redis connection, retry policy, worker pace and health paths.
 * Defaults suit a single local Redis. The demo shortens attempts and backoff when
 * those variables are unset.
 */
export interface JobsConfig {
  redis: RedisSettings;
  /** BullMQ key prefix shared by every worker that should see these queues. */
  prefix: string;
  defaults: JobDefaults;
  worker: WorkerSettings;
  deadLetterQueue: string;
  health: HealthPaths;
}

export interface JobsConfigOverrides {
  redis?: Partial<RedisSettings>;
  prefix?: string;
  defaults?: Partial<Omit<JobDefaults, "backoff">> & { backoff?: Partial<BackoffSettings> };
  worker?: Partial<WorkerSettings>;
  deadLetterQueue?: string;
  health?: Partial<HealthPaths>;
}

const backoffTypes: readonly BackoffType[] = ["exponential", "fixed"];
const queueName = /^[a-z][a-z0-9-]{0,40}$/;

export const defaultJobsConfig: JobsConfig = Object.freeze({
  redis: Object.freeze({
    host: "127.0.0.1",
    port: 6379,
    db: 0,
    tls: false,
  }),
  prefix: "bg",
  defaults: Object.freeze({
    attempts: 5,
    backoff: Object.freeze({
      type: "exponential" as const,
      delayMs: 2000,
    }),
    removeOnComplete: 1000,
    removeOnFail: 5000,
  }),
  worker: Object.freeze({
    concurrency: 5,
    rateLimitMax: 50,
    rateLimitDurationMs: 1000,
  }),
  deadLetterQueue: "dead-letter",
  health: Object.freeze({
    livenessPath: "/health/live",
    readinessPath: "/health/ready",
  }),
});

export function defineJobsConfig(overrides: JobsConfigOverrides = {}): JobsConfig {
  const { backoff: backoffOverrides, ...restDefaults } = overrides.defaults ?? {};
  const redis = { ...defaultJobsConfig.redis, ...defined(overrides.redis ?? {}) };
  if (!redis.password) delete redis.password;
  const config: JobsConfig = {
    redis,
    prefix: overrides.prefix ?? defaultJobsConfig.prefix,
    defaults: {
      ...defaultJobsConfig.defaults,
      ...defined(restDefaults),
      backoff: { ...defaultJobsConfig.defaults.backoff, ...defined(backoffOverrides ?? {}) },
    },
    worker: { ...defaultJobsConfig.worker, ...defined(overrides.worker ?? {}) },
    deadLetterQueue: overrides.deadLetterQueue ?? defaultJobsConfig.deadLetterQueue,
    health: { ...defaultJobsConfig.health, ...defined(overrides.health ?? {}) },
  };
  assertJobsConfig(config);
  return config;
}

export function assertJobsConfig(config: JobsConfig): void {
  if (!/^[A-Za-z0-9._-]{1,253}$/.test(config.redis.host)) {
    throw new Error("redis.host must be a hostname or IP address.");
  }
  if (!Number.isInteger(config.redis.port) || config.redis.port < 1 || config.redis.port > 65535) {
    throw new Error("redis.port must be an integer from 1 to 65535.");
  }
  if (!Number.isInteger(config.redis.db) || config.redis.db < 0 || config.redis.db > 15) {
    throw new Error("redis.db must be an integer from 0 to 15.");
  }
  if (config.redis.password !== undefined && config.redis.password.length > 256) {
    throw new Error("redis.password must be at most 256 characters.");
  }
  if (typeof config.redis.tls !== "boolean") {
    throw new Error("redis.tls must be true or false.");
  }
  assertQueueName(config.prefix, "prefix");
  assertQueueName(config.deadLetterQueue, "deadLetterQueue");
  if (!Number.isInteger(config.defaults.attempts) || config.defaults.attempts < 1 || config.defaults.attempts > 25) {
    throw new Error("defaults.attempts must be an integer from 1 to 25.");
  }
  if (!backoffTypes.includes(config.defaults.backoff.type)) {
    throw new Error("defaults.backoff.type must be exponential or fixed.");
  }
  assertDelay(config.defaults.backoff.delayMs, "defaults.backoff.delayMs");
  assertRetention(config.defaults.removeOnComplete, "defaults.removeOnComplete");
  assertRetention(config.defaults.removeOnFail, "defaults.removeOnFail");
  if (!Number.isInteger(config.worker.concurrency) || config.worker.concurrency < 1 || config.worker.concurrency > 256) {
    throw new Error("worker.concurrency must be an integer from 1 to 256.");
  }
  if (!Number.isInteger(config.worker.rateLimitMax) || config.worker.rateLimitMax < 0 || config.worker.rateLimitMax > 100000) {
    throw new Error("worker.rateLimitMax must be an integer from 0 to 100000.");
  }
  if (
    !Number.isInteger(config.worker.rateLimitDurationMs) ||
    config.worker.rateLimitDurationMs < 1 ||
    config.worker.rateLimitDurationMs > 86_400_000
  ) {
    throw new Error("worker.rateLimitDurationMs must be an integer from 1 to 86400000.");
  }
  assertPath(config.health.livenessPath, "health.livenessPath");
  assertPath(config.health.readinessPath, "health.readinessPath");
  if (config.health.livenessPath === config.health.readinessPath) {
    throw new Error("health paths must be distinct.");
  }
}

export function assertQueueName(value: string, label: string): void {
  if (!queueName.test(value)) {
    throw new Error(`${label} must be a lowercase name of up to 41 characters.`);
  }
}

function assertDelay(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 86_400_000) {
    throw new Error(`${label} must be an integer from 0 to 86400000.`);
  }
}

function assertRetention(value: number | boolean, label: string): void {
  if (typeof value === "boolean") return;
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) {
    throw new Error(`${label} must be true, false or an integer from 0 to 1000000.`);
  }
}

function assertPath(value: string, label: string): void {
  if (!/^\/[A-Za-z0-9._~/-]*$/.test(value) || value.length > 80) {
    throw new Error(`${label} must be a path starting with /.`);
  }
  if (value === "/" || value.startsWith("/api")) {
    throw new Error(`${label} must not cover the dashboard or the API.`);
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

export const buildFingerprint = "background-jobs@0.1.0#src/config/jobs-config.ts";
