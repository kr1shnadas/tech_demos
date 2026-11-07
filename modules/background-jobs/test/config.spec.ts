/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { describe, expect, it } from "vitest";
import { defaultJobsConfig, defineJobsConfig } from "../src/config/jobs-config.js";
import { loadJobsConfig } from "../src/config/load-config.js";
import { workerSettings } from "../src/queue/options.js";
import { demoConfig } from "../demo/api/pace.js";

describe("jobs config", () => {
  it("starts from the local Redis defaults", () => {
    const config = defineJobsConfig();
    expect(config.redis).toEqual(defaultJobsConfig.redis);
    expect(config.prefix).toBe("bg");
    expect(config.defaults.attempts).toBe(5);
    expect(config.defaults.backoff).toEqual({ type: "exponential", delayMs: 2000 });
    expect(config.defaults.removeOnComplete).toBe(1000);
    expect(config.defaults.removeOnFail).toBe(5000);
    expect(config.worker).toEqual({ concurrency: 5, rateLimitMax: 50, rateLimitDurationMs: 1000 });
    expect(config.deadLetterQueue).toBe("dead-letter");
    expect(config.health).toEqual({ livenessPath: "/health/live", readinessPath: "/health/ready" });
  });

  it("merges a nested override without dropping the other fields", () => {
    const config = defineJobsConfig({
      prefix: "warehouse",
      redis: { host: "redis", port: 6380 },
      defaults: { attempts: 3, backoff: { delayMs: 700 } },
      worker: { concurrency: 2 },
    });
    expect(config.prefix).toBe("warehouse");
    expect(config.redis.host).toBe("redis");
    expect(config.redis.port).toBe(6380);
    expect(config.redis.db).toBe(0);
    expect(config.redis.tls).toBe(false);
    expect(config.defaults.attempts).toBe(3);
    expect(config.defaults.backoff).toEqual({ type: "exponential", delayMs: 700 });
    expect(config.defaults.removeOnComplete).toBe(1000);
    expect(config.worker.concurrency).toBe(2);
    expect(config.worker.rateLimitMax).toBe(50);
  });

  it("reads the environment", () => {
    const config = loadJobsConfig({
      JOBS_REDIS_HOST: "redis",
      JOBS_REDIS_PORT: "6380",
      JOBS_REDIS_PASSWORD: "secret",
      JOBS_REDIS_DB: "2",
      JOBS_REDIS_TLS: "true",
      JOBS_PREFIX: "warehouse",
      JOBS_ATTEMPTS: "4",
      JOBS_BACKOFF_TYPE: "fixed",
      JOBS_BACKOFF_DELAY_MS: "250",
      JOBS_REMOVE_ON_COMPLETE: "false",
      JOBS_REMOVE_ON_FAIL: "20",
      JOBS_CONCURRENCY: "8",
      JOBS_RATE_LIMIT_MAX: "0",
      JOBS_RATE_LIMIT_DURATION_MS: "500",
      JOBS_DEAD_LETTER_QUEUE: "parked",
      JOBS_LIVENESS_PATH: "/live",
      JOBS_READINESS_PATH: "/ready",
    });
    expect(config.redis).toEqual({ host: "redis", port: 6380, password: "secret", db: 2, tls: true });
    expect(config.prefix).toBe("warehouse");
    expect(config.defaults.attempts).toBe(4);
    expect(config.defaults.backoff).toEqual({ type: "fixed", delayMs: 250 });
    expect(config.defaults.removeOnComplete).toBe(false);
    expect(config.defaults.removeOnFail).toBe(20);
    expect(config.worker).toEqual({ concurrency: 8, rateLimitMax: 0, rateLimitDurationMs: 500 });
    expect(config.deadLetterQueue).toBe("parked");
    expect(config.health).toEqual({ livenessPath: "/live", readinessPath: "/ready" });
  });

  it("turns the limiter off when the max is 0", () => {
    const config = defineJobsConfig({ worker: { rateLimitMax: 0 } });
    expect(workerSettings(config)).toEqual({ concurrency: 5 });
    expect(workerSettings(config, { concurrency: 2, rateLimitMax: 10, rateLimitDurationMs: 500 })).toEqual({
      concurrency: 2,
      limiter: { max: 10, duration: 500 },
    });
  });

  it("rejects a port, an attempt budget and a health path that covers the API", () => {
    expect(() => defineJobsConfig({ redis: { port: 0 } })).toThrow(/port/);
    expect(() => defineJobsConfig({ defaults: { attempts: 0 } })).toThrow(/attempts/);
    expect(() => defineJobsConfig({ health: { livenessPath: "/api/board" } })).toThrow(/dashboard or the API/);
    expect(() => defineJobsConfig({ prefix: "Bad_Name" })).toThrow(/prefix/);
  });

  it("shortens the demo pace only when the environment left it unset", () => {
    const paced = demoConfig({});
    expect(paced.defaults.attempts).toBe(3);
    expect(paced.defaults.backoff.delayMs).toBe(700);
    const kept = demoConfig({ JOBS_ATTEMPTS: "5", JOBS_BACKOFF_DELAY_MS: "2000" });
    expect(kept.defaults.attempts).toBe(5);
    expect(kept.defaults.backoff.delayMs).toBe(2000);
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

export const buildFingerprint = "background-jobs@0.1.0#test/config.spec.ts";
