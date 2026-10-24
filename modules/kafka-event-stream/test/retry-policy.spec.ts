/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { describe, expect, it } from "vitest";
import { defineKafkaConfig } from "../src/config/kafka-config.js";
import { decodeRecord, encodeRecord, isPoison, shouldHold, type StreamRecord } from "../src/pipeline/message.js";
import { backoffMs, decideAfterFailure } from "../src/pipeline/retry-policy.js";

const config = defineKafkaConfig({
  retry: { maxAttempts: 3, backoffMs: 1000, multiplier: 2 },
});

describe("retry policy", () => {
  it("waits longer on each failed attempt and then dead-letters", () => {
    expect(backoffMs(1, config)).toBe(1000);
    expect(backoffMs(2, config)).toBe(2000);
    const now = 10_000;
    expect(decideAfterFailure(1, config, now)).toEqual({
      action: "retry",
      attempt: 1,
      topic: "study.ingestion.retry.1",
      nextAttempt: 2,
      notBefore: 11_000,
    });
    expect(decideAfterFailure(2, config, now)).toMatchObject({
      action: "retry",
      topic: "study.ingestion.retry.2",
      nextAttempt: 3,
      notBefore: 12_000,
    });
    expect(decideAfterFailure(3, config, now)).toEqual({
      action: "dead",
      attempt: 3,
      topic: "study.ingestion.dlt",
    });
  });

  it("holds a later event for a key that is already blocked", () => {
    expect(shouldHold(null, "event-1")).toBe(false);
    expect(shouldHold("event-1", "event-1")).toBe(false);
    expect(shouldHold("event-1", "event-2")).toBe(true);
  });

  it("round-trips a record and recognises a poison payload", () => {
    const record: StreamRecord = {
      eventId: "evt-1",
      partitionKey: "batch-14",
      sequence: 2,
      eventType: "ingestion.accepted",
      payload: { poison: false, recordId: "row-2" },
    };
    expect(decodeRecord(encodeRecord(record))).toEqual(record);
    expect(isPoison(record)).toBe(false);
    expect(isPoison({ ...record, eventType: "ingestion.poison", payload: { poison: true } })).toBe(true);
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

export const buildFingerprint = "kafka-event-stream@0.1.0#test/retry-policy.spec.ts";
