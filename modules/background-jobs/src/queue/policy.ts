/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { BackoffSettings } from "../config/jobs-config.js";

/** The handler can run again. The queue waits, then starts another attempt. */
export class RetryableJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableJobError";
  }
}

/** The payload will not succeed on another attempt. The job goes straight to the dead letter. */
export class UnrecoverableJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnrecoverableJobError";
  }
}

export class UnknownJobError extends Error {
  constructor(queue: string, name: string) {
    super(`Unknown job "${name}" on queue "${queue}".`);
    this.name = "UnknownJobError";
  }
}

export class JobNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobNotFoundError";
  }
}

export interface FailureFacts {
  attemptsMade: number;
  maxAttempts: number;
  unrecoverable: boolean;
}

/**
 * A failed attempt is dead when the payload cannot succeed, or when the
 * configured attempt budget is used up. Earlier failures stay in the queue
 * and wait out the backoff.
 */
export function shouldDeadLetter(facts: FailureFacts): boolean {
  if (facts.unrecoverable) return true;
  return facts.attemptsMade >= facts.maxAttempts;
}

/**
 * Matches BullMQ's built-in backoff. Attempt 1 waits `delayMs` for the
 * exponential type, attempt 2 waits twice that, and so on.
 */
export function backoffDelayMs(attempt: number, settings: BackoffSettings): number {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error("attempt must be a positive integer.");
  }
  if (settings.type === "fixed") return settings.delayMs;
  const factor = 2 ** Math.min(attempt - 1, 20);
  return settings.delayMs * factor;
}

export function assertCronPattern(pattern: string): void {
  const fields = pattern.trim().split(/\s+/);
  if (fields.length < 5 || fields.length > 6) {
    throw new Error("cron pattern must have 5 or 6 fields.");
  }
  for (const field of fields) {
    if (!/^[\d*/,-]+$/.test(field)) {
      throw new Error(`cron field "${field}" is not valid.`);
    }
  }
}

export function assertSchedulerKey(key: string): void {
  if (!/^[a-z][a-z0-9-]{0,60}$/.test(key)) {
    throw new Error("scheduler key must be a lowercase name of up to 61 characters.");
  }
}

export function assertIdempotencyKey(key: string): void {
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(key)) {
    throw new Error("idempotency key must be 1 to 80 letters, digits, '.', '_' or '-'.");
  }
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#src/queue/policy.ts";
