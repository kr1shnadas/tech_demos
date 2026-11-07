/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export function subjectOf(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  for (const key of ["batchId", "feedId", "messageId", "digestId"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function queuedMessage(queue: string, name: string, subject: string, delayMs?: number, duplicate = false): string {
  if (duplicate) return line([queue, name, subject, "was already queued"]);
  if (delayMs && delayMs > 0) return line([queue, name, subject, "queued, starts in", `${delayMs}ms`]);
  return line([queue, name, subject, "queued"]);
}

export function startedMessage(queue: string, name: string, subject: string, attempt: number): string {
  return line([queue, name, subject, "started attempt", String(attempt)]);
}

export function failedMessage(
  queue: string,
  name: string,
  subject: string,
  attempt: number,
  reason: string,
  nextDelayMs?: number,
): string {
  const wait = nextDelayMs === undefined ? "" : `Next try in ${nextDelayMs}ms.`;
  return line([queue, name, subject, `failed attempt ${attempt}: ${reason}.`, wait]);
}

export function deadMessage(queue: string, name: string, subject: string, attempts: number, reason: string): string {
  return line([queue, name, subject, `moved to the dead letter after ${attempts} attempts: ${reason}`]);
}

export function finishedMessage(queue: string, name: string, subject: string, value: unknown): string {
  return line([queue, name, subject, "finished" + finishedDetail(value)]);
}

export function retriedMessage(queue: string, name: string, subject: string): string {
  return line([queue, name, subject, "retried from the dead letter"]);
}

function finishedDetail(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (record.duplicate === true) return " — already applied";
  if (typeof record.accepted === "number" && typeof record.rejected === "number") {
    return ` — ${record.accepted} accepted, ${record.rejected} rejected`;
  }
  if (record.delivered === true) return " — notice sent";
  if (record.accepted === true) {
    const attempts = typeof record.attemptsMade === "number" ? record.attemptsMade : 0;
    return attempts > 1 ? ` — feed accepted on attempt ${attempts}` : " — feed accepted";
  }
  return "";
}

function line(parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#src/queue/messages.ts";
