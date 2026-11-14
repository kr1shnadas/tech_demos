/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { describe, expect, it } from "vitest";
import { deadMessage, failedMessage, finishedMessage, queuedMessage } from "../src/queue/messages.js";
import { assertCronPattern, backoffDelayMs, shouldDeadLetter } from "../src/queue/policy.js";
import { assertRegistrations } from "../src/queue/runtime.js";
import { defineJobsConfig } from "../src/config/jobs-config.js";
import { defineJob, defineQueue } from "../src/queue/contracts.js";

describe("retry policy", () => {
  it("grows the exponential wait and keeps a fixed wait flat", () => {
    expect(backoffDelayMs(1, { type: "exponential", delayMs: 700 })).toBe(700);
    expect(backoffDelayMs(2, { type: "exponential", delayMs: 700 })).toBe(1400);
    expect(backoffDelayMs(3, { type: "exponential", delayMs: 700 })).toBe(2800);
    expect(backoffDelayMs(3, { type: "fixed", delayMs: 700 })).toBe(700);
  });

  it("dead-letters an exhausted attempt and an unrecoverable payload", () => {
    expect(shouldDeadLetter({ attemptsMade: 2, maxAttempts: 5, unrecoverable: false })).toBe(false);
    expect(shouldDeadLetter({ attemptsMade: 5, maxAttempts: 5, unrecoverable: false })).toBe(true);
    expect(shouldDeadLetter({ attemptsMade: 1, maxAttempts: 5, unrecoverable: true })).toBe(true);
  });

  it("rejects a cron pattern with the wrong number of fields", () => {
    expect(() => assertCronPattern("* * *")).toThrow(/5 or 6 fields/);
    expect(() => assertCronPattern("* * * * *")).not.toThrow();
  });

  it("describes a retry and a dead letter in the activity line", () => {
    expect(queuedMessage("ingestion", "import-batch", "batch-1")).toBe("ingestion import-batch batch-1 queued");
    expect(failedMessage("ingestion", "sync-feed", "feed-1", 1, "warehouse feed returned 503", 700)).toContain(
      "Next try in 700ms",
    );
    expect(deadMessage("ingestion", "sync-feed", "feed-1", 3, "warehouse feed returned 500")).toContain("dead letter");
    expect(finishedMessage("ingestion", "import-batch", "batch-1", { accepted: 3, rejected: 1, duplicate: false })).toContain(
      "3 accepted",
    );
  });

  it("rejects a handler for a job the queue does not define", () => {
    const queue = defineQueue("pace", { hold: defineJob<{ ms: number }, { ok: true }>("hold") });
    expect(() =>
      assertRegistrations(defineJobsConfig(), [
        { spec: queue, handlers: { missing: async () => ({ ok: true }) } },
      ]),
    ).toThrow(/not on queue/);
    expect(() => defineQueue("pace", { hold: defineJob<{ ok: true }>("other") })).toThrow(/does not match/);
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

export const buildFingerprint = "background-jobs@0.1.0#test/policy.spec.ts";
