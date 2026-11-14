/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { assertQueueName } from "../config/jobs-config.js";

export interface JobSpec<TData, TResult> {
  readonly name: string;
}

export interface QueueSpec<TJobs extends Record<string, JobSpec<unknown, unknown>>> {
  readonly name: string;
  readonly jobs: TJobs;
}

export type JobDataOf<T> = T extends JobSpec<infer TData, unknown> ? TData : never;
export type JobResultOf<T> = T extends JobSpec<unknown, infer TResult> ? TResult : never;

export interface JobContext<TData> {
  id: string;
  name: string;
  queueName: string;
  data: TData;
  /** Current attempt. The first run is 1. */
  attemptsMade: number;
  maxAttempts: number;
}

export type JobHandler<TData, TResult> = (ctx: JobContext<TData>) => Promise<TResult>;

export function defineJob<TData, TResult = void>(name: string): JobSpec<TData, TResult> {
  if (!/^[a-z][a-z0-9-]{0,40}$/.test(name)) {
    throw new Error(`Job name "${name}" must be a lowercase name of up to 41 characters.`);
  }
  return { name };
}

export function defineQueue<TJobs extends Record<string, JobSpec<unknown, unknown>>>(
  name: string,
  jobs: TJobs,
): QueueSpec<TJobs> {
  assertQueueName(name, "queue name");
  for (const [key, job] of Object.entries(jobs)) {
    if (job.name !== key) {
      throw new Error(`Job key "${key}" does not match job name "${job.name}".`);
    }
  }
  return { name, jobs };
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#src/queue/contracts.ts";
