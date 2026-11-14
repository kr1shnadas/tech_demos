/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Queue, type JobsOptions, type RepeatOptions } from "bullmq";
import type { JobsConfig } from "../config/jobs-config.js";
import type { JobDataOf, JobSpec, QueueSpec } from "./contracts.js";
import { queuedMessage, subjectOf } from "./messages.js";
import {
  UnknownJobError,
  assertCronPattern,
  assertIdempotencyKey,
  assertSchedulerKey,
} from "./policy.js";

export interface EnqueueOptions {
  /** Stored as the queue job id. A second add with the same key returns the existing job. */
  idempotencyKey?: string;
  delayMs?: number;
  attempts?: number;
  backoff?: { type: "exponential" | "fixed"; delayMs: number };
  priority?: number;
}

export interface ScheduleOptions {
  key: string;
  limit?: number;
  pattern?: string;
  everyMs?: number;
}

export interface EnqueuedJob<K extends string> {
  id: string;
  name: K;
  queue: string;
  duplicate: boolean;
}

export interface ProducerListener {
  queued(event: { queue: string; name: string; jobId: string; message: string }): void;
}

export class QueueProducer<TJobs extends Record<string, JobSpec<unknown, unknown>>> {
  constructor(
    private readonly queue: Queue,
    private readonly spec: QueueSpec<TJobs>,
    private readonly config: JobsConfig,
    private readonly listener: ProducerListener,
  ) {}

  async add<K extends keyof TJobs & string>(
    name: K,
    data: JobDataOf<TJobs[K]>,
    options: EnqueueOptions = {},
  ): Promise<EnqueuedJob<K>> {
    this.assertKnown(name);
    if (options.idempotencyKey) {
      assertIdempotencyKey(options.idempotencyKey);
      const existing = await this.queue.getJob(options.idempotencyKey);
      if (existing?.id) {
        this.listener.queued({
          queue: this.spec.name,
          name,
          jobId: existing.id,
          message: queuedMessage(this.spec.name, name, subjectOf(data), undefined, true),
        });
        return { id: existing.id, name, queue: this.spec.name, duplicate: true };
      }
    }
    const jobOptions = this.jobOptions(options);
    try {
      const job = await this.queue.add(name, data, jobOptions);
      const id = requiredId(job.id);
      this.listener.queued({
        queue: this.spec.name,
        name,
        jobId: id,
        message: queuedMessage(this.spec.name, name, subjectOf(data), options.delayMs, false),
      });
      return { id, name, queue: this.spec.name, duplicate: false };
    } catch (error) {
      if (options.idempotencyKey && isDuplicateJob(error)) {
        const existing = await this.queue.getJob(options.idempotencyKey);
        if (existing?.id) {
          this.listener.queued({
            queue: this.spec.name,
            name,
            jobId: existing.id,
            message: queuedMessage(this.spec.name, name, subjectOf(data), undefined, true),
          });
          return { id: existing.id, name, queue: this.spec.name, duplicate: true };
        }
      }
      throw error;
    }
  }

  /**
   * Registers one repeatable job. The same scheduler key updates the schedule
   * instead of adding a second copy.
   */
  async schedule<K extends keyof TJobs & string>(
    name: K,
    data: JobDataOf<TJobs[K]>,
    options: ScheduleOptions,
  ): Promise<{ key: string; name: K; queue: string }> {
    this.assertKnown(name);
    assertSchedulerKey(options.key);
    const repeat = repeatOptions(options);
    await this.queue.upsertJobScheduler(
      options.key,
      repeat,
      {
        name,
        data,
        opts: {
          attempts: this.config.defaults.attempts,
          backoff: {
            type: this.config.defaults.backoff.type,
            delay: this.config.defaults.backoff.delayMs,
          },
        },
      },
    );
    const when = options.pattern ? `cron ${options.pattern}` : `every ${options.everyMs}ms`;
    this.listener.queued({
      queue: this.spec.name,
      name,
      jobId: options.key,
      message: `${this.spec.name} ${name} ${subjectOf(data)} scheduled ${when}`.replace(/\s+/g, " ").trim(),
    });
    return { key: options.key, name, queue: this.spec.name };
  }

  async removeSchedule(key: string): Promise<void> {
    assertSchedulerKey(key);
    await this.queue.removeJobScheduler(key);
  }

  private assertKnown(name: string): void {
    if (!this.spec.jobs[name]) throw new UnknownJobError(this.spec.name, name);
  }

  private jobOptions(options: EnqueueOptions): JobsOptions {
    const jobOptions: JobsOptions = {};
    if (options.idempotencyKey) {
      assertIdempotencyKey(options.idempotencyKey);
      jobOptions.jobId = options.idempotencyKey;
    }
    if (options.delayMs !== undefined) {
      if (!Number.isInteger(options.delayMs) || options.delayMs < 0 || options.delayMs > 86_400_000) {
        throw new Error("delayMs must be an integer from 0 to 86400000.");
      }
      jobOptions.delay = options.delayMs;
    }
    if (options.attempts !== undefined) jobOptions.attempts = options.attempts;
    if (options.backoff) {
      jobOptions.backoff = { type: options.backoff.type, delay: options.backoff.delayMs };
    }
    if (options.priority !== undefined) jobOptions.priority = options.priority;
    return jobOptions;
  }
}

function repeatOptions(options: ScheduleOptions): Omit<RepeatOptions, "key"> {
  if (options.pattern && options.everyMs) {
    throw new Error("Choose a cron pattern or an interval, not both.");
  }
  if (options.pattern) {
    assertCronPattern(options.pattern);
    return { pattern: options.pattern, limit: options.limit };
  }
  if (options.everyMs === undefined) throw new Error("A schedule needs a cron pattern or an interval.");
  if (!Number.isInteger(options.everyMs) || options.everyMs < 50 || options.everyMs > 86_400_000) {
    throw new Error("everyMs must be an integer from 50 to 86400000.");
  }
  return { every: options.everyMs, limit: options.limit };
}

function requiredId(id: string | undefined): string {
  if (!id) throw new Error("The queue did not return a job id.");
  return id;
}

function isDuplicateJob(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "JobIdAlreadyExistsError" || /already exists/i.test(error.message);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#src/queue/producer.ts";
