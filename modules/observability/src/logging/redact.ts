/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export const redacted = "[redacted]";

const maxDepth = 8;

/**
 * Returns a copy of `value` with configured keys replaced.
 * A key matches when its lower-case form is in `fields`. Nested objects and arrays are walked.
 */
export function redactValue(value: unknown, fields: ReadonlySet<string>, depth = 0): unknown {
  if (depth > maxDepth) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, fields, depth + 1));
  }
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (fields.has(key.toLowerCase())) output[key] = redacted;
    else output[key] = redactValue(child, fields, depth + 1);
  }
  return output;
}

export function redactFieldSet(fields: readonly string[]): Set<string> {
  return new Set(fields.map((field) => field.toLowerCase()));
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#src/logging/redact.ts";
