/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Queue, UnrecoverableError, Worker, type Job, type JobsOptions } from "bullmq";
import type { BackoffSettings, JobsConfig } from "../config/jobs-config.js";
import { assertQueueName } from "../config/jobs-config.js";
import type { JobHandler, JobSpec, QueueSpec } from "./contracts.js";
import {
  deadMessage,
  failedMessage,
  finishedMessage,
  retriedMessage,
  startedMessage,
  subjectOf,
} from "./messages.js";
import { bullConnection, defaultJobOptions, workerSettings, type WorkerOverride } from "./options.js";
import { QueueProducer, type ProducerListener } from "./producer.js";
import { JobNotFoundError, UnrecoverableJobError, shouldDeadLetter } from "./policy.js";

export interface QueueRegistration extends WorkerOverride {
  spec: QueueSpec<Record<string, JobSpec<unknown, unknown>>>;
  handlers: Record<string, JobHandler<unknown, unknown>>;
}

export type ActivityKind = "queued" | "started" | "finished" | "failed" | "dead" | "retried";

export interface ActivityEntry {
  at: string;
  kind: ActivityKind;
  queue: string;
  name: string;
  jobId: string;
  message: string;
}

export interface QueueCounts {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  deadLetter: number;
}

export interface FailedRow {
  queue: string;
  jobId: string;
  name: string;
  subject: string;
  attemptsMade: number;
  reason: string;
}

export interface DeadLetterRecord {
  sourceQueue: string;
  jobName: string;
  jobId: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  failedAt: string;
  unrecoverable: boolean;
}

export interface DeadLetterRow {
  id: string;
  sourceQueue: string;
  jobName: string;
  jobId: string;
  subject: string;
  attemptsMade: number;
  failedReason: string;
  failedAt: string;
}

export interface BoardSnapshot {
  redis: "up" | "down";
  queues: QueueCounts[];
  failed: FailedRow[];
  deadLetter: DeadLetterRow[];
  activity: ActivityEntry[];
}

const activityLimit = 80;

export function assertRegistrations(config: JobsConfig, registrations: QueueRegistration[]): void {
  const names = new Set<string>();
  for (const registration of registrations) {
    assertQueueName(registration.spec.name, "queue name");
    if (names.has(registration.spec.name)) {
      throw new Error(`Duplicate queue "${registration.spec.name}".`);
    }
    names.add(registration.spec.name);
    if (registration.spec.name === config.deadLetterQueue) {
      throw new Error("A work queue must not use the dead-letter queue name.");
    }
    for (const name of Object.keys(registration.handlers)) {
      if (!registration.spec.jobs[name]) {
        throw new Error(`Handler "${name}" is not on queue "${registration.spec.name}".`);
      }
    }
  }
}

/**
 * Owns the BullMQ queues and workers for one process.
 * `close` stops workers first and waits for the job they are already running.
 */
export class JobRuntime {
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];
  private readonly activity: ActivityEntry[] = [];
  private closed = false;

  private constructor(
    readonly config: JobsConfig,
    private readonly registrations: QueueRegistration[],
    private readonly dead: Queue,
  ) {}

  static async open(config: JobsConfig, registrations: QueueRegistration[]): Promise<JobRuntime> {
    assertRegistrations(config, registrations);
    const connection = bullConnection(config);
    const dead = new Queue(config.deadLetterQueue, { connection, prefix: config.prefix });
    const runtime = new JobRuntime(config, registrations, dead);
    try {
      for (const registration of registrations) {
        const queue = new Queue(registration.spec.name, {
          connection,
          prefix: config.prefix,
          defaultJobOptions: defaultJobOptions(config),
        });
        runtime.queues.set(registration.spec.name, queue);
        const worker = new Worker(
          registration.spec.name,
          (job) => runtime.run(registration, job),
          {
            connection,
            prefix: config.prefix,
            ...workerSettings(config, registration),
          },
        );
        worker.on("error", () => undefined);
        queue.on("error", () => undefined);
        worker.on("active", (job) => {
          runtime.record("started", job.queueName, job.name, job.id ?? "", startedMessage(
            job.queueName,
            job.name,
            subjectOf(job.data),
            job.attemptsMade + 1,
          ));
        });
        worker.on("completed", (job) => {
          runtime.record("finished", job.queueName, job.name, job.id ?? "", finishedMessage(
            job.queueName,
            job.name,
            subjectOf(job.data),
            job.returnvalue,
          ));
        });
        worker.on("failed", (job, error) => {
          if (!job) return;
          void runtime.onFailed(job, error).catch((cause: unknown) => {
            const message = cause instanceof Error ? cause.message : "dead-letter copy failed";
            runtime.record("failed", job.queueName, job.name, job.id ?? "", message);
          });
        });
        runtime.workers.push(worker);
      }
      dead.on("error", () => undefined);
      await Promise.all([
        dead.waitUntilReady(),
        ...[...runtime.queues.values()].map((queue) => queue.waitUntilReady()),
        ...runtime.workers.map((worker) => worker.waitUntilReady()),
      ]);
      return runtime;
    } catch (error) {
      await runtime.close();
      throw error;
    }
  }

  producer<TJobs extends Record<string, JobSpec<unknown, unknown>>>(queueName: string): QueueProducer<TJobs> {
    const registration = this.registrations.find((item) => item.spec.name === queueName);
    const queue = this.queues.get(queueName);
    if (!registration || !queue) throw new Error(`Unknown queue "${queueName}".`);
    const listener: ProducerListener = {
      queued: (event) => this.record("queued", event.queue, event.name, event.jobId, event.message),
    };
    return new QueueProducer(queue, registration.spec as QueueSpec<TJobs>, this.config, listener);
  }

  async getJob(queueName: string, jobId: string): Promise<Job | undefined> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Unknown queue "${queueName}".`);
    return (await queue.getJob(jobId)) ?? undefined;
  }

  async ping(): Promise<boolean> {
    try {
      const client = (await this.dead.client) as unknown as { ping: () => Promise<string> };
      return (await client.ping()) === "PONG";
    } catch {
      return false;
    }
  }

  async snapshot(): Promise<BoardSnapshot> {
    const letters = await this.listDeadLetters();
    const counts = new Map<string, number>();
    for (const letter of letters) {
      counts.set(letter.sourceQueue, (counts.get(letter.sourceQueue) ?? 0) + 1);
    }
    const queues: QueueCounts[] = [];
    for (const [name, queue] of this.queues) {
      const raw = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
      queues.push({
        name,
        waiting: raw.waiting ?? 0,
        active: raw.active ?? 0,
        completed: raw.completed ?? 0,
        failed: raw.failed ?? 0,
        delayed: raw.delayed ?? 0,
        deadLetter: counts.get(name) ?? 0,
      });
    }
    return {
      redis: (await this.ping()) ? "up" : "down",
      queues,
      failed: await this.listFailed(),
      deadLetter: letters.slice(0, 30),
      activity: this.activity.slice(0, 40),
    };
  }

  async retryFailed(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (!job) throw new JobNotFoundError(`Job ${jobId} was not found on ${queueName}.`);
    if (!(await job.isFailed())) throw new JobNotFoundError("Only a failed job can be retried.");
    await job.retry("failed");
    await this.removeDeadLettersFor(queueName, jobId);
    this.record("retried", queueName, job.name, jobId, retriedMessage(queueName, job.name, subjectOf(job.data)));
  }

  async retryDeadLetter(deadId: string): Promise<{ id: string; queue: string; name: string }> {
    const job = await this.dead.getJob(deadId);
    if (!job) throw new JobNotFoundError("Dead letter not found.");
    const record = readRecord(job.data);
    const producer = this.producer(record.sourceQueue);
    const added = await producer.add(record.jobName, record.data as never);
    await job.remove();
    const original = await this.getJob(record.sourceQueue, record.jobId);
    if (original && (await original.isFailed())) await original.remove();
    this.record(
      "retried",
      record.sourceQueue,
      record.jobName,
      added.id,
      retriedMessage(record.sourceQueue, record.jobName, subjectOf(record.data)),
    );
    return { id: added.id, queue: record.sourceQueue, name: record.jobName };
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await Promise.all(this.workers.map((worker) => worker.close()));
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    await this.dead.close();
  }

  private async run(registration: QueueRegistration, job: Job): Promise<unknown> {
    const handler = registration.handlers[job.name];
    if (!handler) {
      throw new UnrecoverableError(`No handler for "${job.name}" on queue "${registration.spec.name}".`);
    }
    try {
      return await handler({
        id: job.id ?? "",
        name: job.name,
        queueName: registration.spec.name,
        data: job.data,
        // BullMQ counts finished attempts. During the run the field is still the previous total.
        attemptsMade: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts ?? this.config.defaults.attempts,
      });
    } catch (error) {
      if (error instanceof UnrecoverableJobError) throw new UnrecoverableError(error.message);
      throw error;
    }
  }

  private async onFailed(job: Job, error: Error): Promise<void> {
    const maxAttempts = job.opts.attempts ?? this.config.defaults.attempts;
    const unrecoverable = error instanceof UnrecoverableError || error.name === "UnrecoverableError";
    const dead = shouldDeadLetter({ attemptsMade: job.attemptsMade, maxAttempts, unrecoverable });
    const backoff = backoffOf(job, this.config);
    const nextDelayMs = dead ? undefined : backoffDelaySafe(job.attemptsMade, backoff);
    this.record(
      "failed",
      job.queueName,
      job.name,
      job.id ?? "",
      failedMessage(job.queueName, job.name, subjectOf(job.data), job.attemptsMade, error.message, nextDelayMs),
    );
    if (!dead) return;
    await this.copyToDeadLetter(job, error, unrecoverable);
  }

  private async copyToDeadLetter(job: Job, error: Error, unrecoverable: boolean): Promise<void> {
    const record: DeadLetterRecord = {
      sourceQueue: job.queueName,
      jobName: job.name,
      jobId: job.id ?? "",
      data: job.data,
      failedReason: error.message,
      attemptsMade: job.attemptsMade,
      failedAt: new Date().toISOString(),
      unrecoverable,
    };
    const deadId = `${record.sourceQueue}__${record.jobId}__${record.attemptsMade}`.replace(/:/g, "_");
    const options: JobsOptions = { jobId: deadId, removeOnComplete: false, removeOnFail: false };
    try {
      await this.dead.add("dead-letter", record, options);
    } catch (cause) {
      if (!isDuplicate(cause)) throw cause;
    }
    this.record(
      "dead",
      record.sourceQueue,
      record.jobName,
      record.jobId,
      deadMessage(record.sourceQueue, record.jobName, subjectOf(record.data), record.attemptsMade, error.message),
    );
  }

  private async listFailed(): Promise<FailedRow[]> {
    const rows: FailedRow[] = [];
    for (const [queueName, queue] of this.queues) {
      const jobs = await queue.getJobs(["failed"], 0, 20, false);
      for (const job of jobs) {
        rows.push({
          queue: queueName,
          jobId: job.id ?? "",
          name: job.name,
          subject: subjectOf(job.data),
          attemptsMade: job.attemptsMade,
          reason: job.failedReason ?? "",
        });
      }
    }
    return rows.slice(0, 20);
  }

  private async listDeadLetters(): Promise<DeadLetterRow[]> {
    const jobs = await this.dead.getJobs(["waiting", "delayed", "paused"], 0, 100, false);
    return jobs.flatMap((job) => {
      if (!isRecord(job.data)) return [];
      return [{
        id: job.id ?? "",
        sourceQueue: job.data.sourceQueue,
        jobName: job.data.jobName,
        jobId: job.data.jobId,
        subject: subjectOf(job.data.data),
        attemptsMade: job.data.attemptsMade,
        failedReason: job.data.failedReason,
        failedAt: job.data.failedAt,
      }];
    });
  }

  private async removeDeadLettersFor(queueName: string, jobId: string): Promise<void> {
    const jobs = await this.dead.getJobs(["waiting", "delayed", "paused"], 0, 100, false);
    for (const job of jobs) {
      if (!isRecord(job.data)) continue;
      if (job.data.sourceQueue === queueName && job.data.jobId === jobId) await job.remove();
    }
  }

  private record(kind: ActivityKind, queue: string, name: string, jobId: string, message: string): void {
    this.activity.unshift({ at: new Date().toISOString(), kind, queue, name, jobId, message });
    if (this.activity.length > activityLimit) this.activity.pop();
  }
}

function backoffOf(job: Job, config: JobsConfig): BackoffSettings {
  const backoff = job.opts.backoff;
  if (backoff && typeof backoff === "object" && "delay" in backoff) {
    const type = backoff.type === "fixed" ? "fixed" : "exponential";
    const delayMs = typeof backoff.delay === "number" ? backoff.delay : config.defaults.backoff.delayMs;
    return { type, delayMs };
  }
  return config.defaults.backoff;
}

function backoffDelaySafe(attempt: number, settings: BackoffSettings): number {
  if (settings.type === "fixed") return settings.delayMs;
  const factor = 2 ** Math.min(Math.max(attempt, 1) - 1, 20);
  return settings.delayMs * factor;
}

function readRecord(data: unknown): DeadLetterRecord {
  if (!isRecord(data)) throw new Error("Dead letter is missing its source job.");
  return data;
}

function isRecord(data: unknown): data is DeadLetterRecord {
  if (!data || typeof data !== "object") return false;
  const record = data as Partial<DeadLetterRecord>;
  return typeof record.sourceQueue === "string" && typeof record.jobName === "string" && typeof record.jobId === "string";
}

function isDuplicate(error: unknown): boolean {
  return error instanceof Error && /already exists/i.test(error.message);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#src/queue/runtime.ts";
