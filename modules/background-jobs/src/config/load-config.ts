/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { existsSync, readFileSync } from "node:fs";
import {
  defineJobsConfig,
  type BackoffType,
  type JobsConfig,
  type JobsConfigOverrides,
} from "./jobs-config.js";

const backoffTypes = new Set(["exponential", "fixed"]);

/**
 * Builds the config from the environment.
 * Unset variables keep the defaults in `defineJobsConfig`.
 * When this reads `process.env` and a `.env` file is present, values already
 * set in the environment win.
 */
export function loadJobsConfig(env: NodeJS.ProcessEnv = process.env): JobsConfig {
  if (env === process.env) loadEnvFile();
  const overrides: JobsConfigOverrides = {};

  const redis: NonNullable<JobsConfigOverrides["redis"]> = {};
  if (present(env.JOBS_REDIS_HOST)) redis.host = env.JOBS_REDIS_HOST.trim();
  if (present(env.JOBS_REDIS_PORT)) redis.port = readInt("JOBS_REDIS_PORT", env.JOBS_REDIS_PORT);
  if (present(env.JOBS_REDIS_PASSWORD)) redis.password = env.JOBS_REDIS_PASSWORD;
  if (present(env.JOBS_REDIS_DB)) redis.db = readInt("JOBS_REDIS_DB", env.JOBS_REDIS_DB);
  if (present(env.JOBS_REDIS_TLS)) redis.tls = readBool("JOBS_REDIS_TLS", env.JOBS_REDIS_TLS);
  if (Object.keys(redis).length > 0) overrides.redis = redis;

  if (present(env.JOBS_PREFIX)) overrides.prefix = env.JOBS_PREFIX.trim();
  if (present(env.JOBS_DEAD_LETTER_QUEUE)) overrides.deadLetterQueue = env.JOBS_DEAD_LETTER_QUEUE.trim();

  const defaults: NonNullable<JobsConfigOverrides["defaults"]> = {};
  if (present(env.JOBS_ATTEMPTS)) defaults.attempts = readInt("JOBS_ATTEMPTS", env.JOBS_ATTEMPTS);
  if (present(env.JOBS_REMOVE_ON_COMPLETE)) {
    defaults.removeOnComplete = readRetention("JOBS_REMOVE_ON_COMPLETE", env.JOBS_REMOVE_ON_COMPLETE);
  }
  if (present(env.JOBS_REMOVE_ON_FAIL)) {
    defaults.removeOnFail = readRetention("JOBS_REMOVE_ON_FAIL", env.JOBS_REMOVE_ON_FAIL);
  }
  const backoff: NonNullable<NonNullable<JobsConfigOverrides["defaults"]>["backoff"]> = {};
  if (present(env.JOBS_BACKOFF_TYPE)) backoff.type = readBackoff(env.JOBS_BACKOFF_TYPE);
  if (present(env.JOBS_BACKOFF_DELAY_MS)) {
    backoff.delayMs = readInt("JOBS_BACKOFF_DELAY_MS", env.JOBS_BACKOFF_DELAY_MS);
  }
  if (Object.keys(backoff).length > 0) defaults.backoff = backoff;
  if (Object.keys(defaults).length > 0) overrides.defaults = defaults;

  const worker: NonNullable<JobsConfigOverrides["worker"]> = {};
  if (present(env.JOBS_CONCURRENCY)) worker.concurrency = readInt("JOBS_CONCURRENCY", env.JOBS_CONCURRENCY);
  if (present(env.JOBS_RATE_LIMIT_MAX)) worker.rateLimitMax = readInt("JOBS_RATE_LIMIT_MAX", env.JOBS_RATE_LIMIT_MAX);
  if (present(env.JOBS_RATE_LIMIT_DURATION_MS)) {
    worker.rateLimitDurationMs = readInt("JOBS_RATE_LIMIT_DURATION_MS", env.JOBS_RATE_LIMIT_DURATION_MS);
  }
  if (Object.keys(worker).length > 0) overrides.worker = worker;

  const health: NonNullable<JobsConfigOverrides["health"]> = {};
  if (present(env.JOBS_LIVENESS_PATH)) health.livenessPath = env.JOBS_LIVENESS_PATH.trim();
  if (present(env.JOBS_READINESS_PATH)) health.readinessPath = env.JOBS_READINESS_PATH.trim();
  if (Object.keys(health).length > 0) overrides.health = health;

  return defineJobsConfig(overrides);
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

function readInt(name: string, raw: string): number {
  const value = raw.trim();
  if (!/^-?\d+$/.test(value)) throw new Error(`${name} must be an integer.`);
  return Number(value);
}

function readBool(name: string, raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new Error(`${name} must be true or false.`);
}

function readBackoff(raw: string): BackoffType {
  const value = raw.trim().toLowerCase();
  if (!backoffTypes.has(value)) throw new Error("JOBS_BACKOFF_TYPE must be exponential or fixed.");
  return value as BackoffType;
}

function readRetention(name: string, raw: string): number | boolean {
  const value = raw.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be true, false or an integer.`);
  return Number(value);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#src/config/load-config.ts";
