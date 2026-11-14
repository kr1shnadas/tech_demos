/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { JobsOptions, WorkerOptions } from "bullmq";
import type { RedisOptions } from "ioredis";
import type { JobsConfig, WorkerSettings } from "../config/jobs-config.js";

export interface WorkerOverride {
  concurrency?: number;
  rateLimitMax?: number;
  rateLimitDurationMs?: number;
}

/** BullMQ workers require `maxRetriesPerRequest: null` so blocking commands are not cut off. */
export function bullConnection(config: JobsConfig): RedisOptions {
  return redisOptions(config, null);
}

export function commandConnection(config: JobsConfig): RedisOptions {
  return redisOptions(config, 2);
}

function redisOptions(config: JobsConfig, maxRetriesPerRequest: number | null): RedisOptions {
  const options: RedisOptions = {
    host: config.redis.host,
    port: config.redis.port,
    db: config.redis.db,
    maxRetriesPerRequest,
  };
  if (config.redis.password) options.password = config.redis.password;
  if (config.redis.tls) options.tls = {};
  return options;
}

export function defaultJobOptions(config: JobsConfig): JobsOptions {
  return {
    attempts: config.defaults.attempts,
    backoff: {
      type: config.defaults.backoff.type,
      delay: config.defaults.backoff.delayMs,
    },
    removeOnComplete: retention(config.defaults.removeOnComplete),
    removeOnFail: retention(config.defaults.removeOnFail),
  };
}

export function workerSettings(config: JobsConfig, override: WorkerOverride = {}): Pick<WorkerOptions, "concurrency" | "limiter"> {
  const concurrency = override.concurrency ?? config.worker.concurrency;
  const max = override.rateLimitMax ?? config.worker.rateLimitMax;
  const duration = override.rateLimitDurationMs ?? config.worker.rateLimitDurationMs;
  const settings: Pick<WorkerOptions, "concurrency" | "limiter"> = { concurrency };
  if (max > 0) settings.limiter = { max, duration };
  return settings;
}

export function retention(value: number | boolean): boolean | { count: number } {
  if (typeof value === "boolean") return value;
  return { count: value };
}

export function describeWorker(settings: WorkerSettings): string {
  const limit = settings.rateLimitMax > 0
    ? `${settings.rateLimitMax} jobs / ${settings.rateLimitDurationMs}ms`
    : "off";
  return `concurrency ${settings.concurrency}, rate limit ${limit}`;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#src/queue/options.ts";
