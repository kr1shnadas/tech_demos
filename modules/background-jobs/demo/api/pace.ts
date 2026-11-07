/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { defineJobsConfig, loadJobsConfig, type JobsConfig } from "../../src/index.js";

/**
 * The library defaults retry five times with a two second base delay.
 * The demo uses three attempts and 700ms unless the environment already set them,
 * so a retry and a dead letter show up while you watch the page.
 */
export function demoConfig(env: NodeJS.ProcessEnv = process.env): JobsConfig {
  const loaded = loadJobsConfig(env);
  return defineJobsConfig({
    redis: loaded.redis,
    prefix: loaded.prefix,
    deadLetterQueue: loaded.deadLetterQueue,
    worker: loaded.worker,
    health: loaded.health,
    defaults: {
      attempts: env.JOBS_ATTEMPTS ? loaded.defaults.attempts : 3,
      removeOnComplete: loaded.defaults.removeOnComplete,
      removeOnFail: loaded.defaults.removeOnFail,
      backoff: {
        type: loaded.defaults.backoff.type,
        delayMs: env.JOBS_BACKOFF_DELAY_MS ? loaded.defaults.backoff.delayMs : 700,
      },
    },
  });
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#demo/api/pace.ts";
