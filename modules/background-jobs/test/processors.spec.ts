/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { describe, expect, it } from "vitest";
import { handleImportBatch, tallyBatch, type ImportBatch } from "../src/jobs/import-batch.js";
import { handleSendNotice, type Notice } from "../src/jobs/send-notice.js";
import { feedNeedsRetry, handleFeedSync, releaseFeed, type FeedSync } from "../src/jobs/sync-feed.js";
import { MemoryIdempotencyStore } from "../src/queue/idempotency.js";
import { RetryableJobError, UnrecoverableJobError } from "../src/queue/policy.js";

const receivedAt = "2026-11-07T08:00:00.000Z";

function batch(overrides: Partial<ImportBatch> = {}): ImportBatch {
  return {
    batchId: "batch-1",
    source: "warehouse-east",
    records: [
      { sku: "CAB-14", quantity: 24, receivedAt },
      { sku: "LUG-02", quantity: 6, receivedAt },
      { sku: "TRAY", quantity: -3, receivedAt },
    ],
    ...overrides,
  };
}

function notice(): Notice {
  return {
    messageId: "notice-1",
    to: "receiving-desk@example.com",
    subject: "Pallet on the dock",
    body: "CAB-14 is ready for the shelf.",
  };
}

function feed(outcome: FeedSync["outcome"]): FeedSync {
  return { feedId: "feed-1", source: "warehouse-east", outcome, succeedAfter: 3 };
}

describe("processors", () => {
  it("counts accepted and rejected lines, then ignores a second apply", async () => {
    expect(tallyBatch(batch())).toEqual({ accepted: 2, rejected: 1 });
    const store = new MemoryIdempotencyStore();
    const first = await handleImportBatch(batch(), store);
    const second = await handleImportBatch(batch(), store);
    expect(first).toEqual({ batchId: "batch-1", accepted: 2, rejected: 1, duplicate: false });
    expect(second).toEqual({ batchId: "batch-1", accepted: 0, rejected: 0, duplicate: true });
  });

  it("rejects a batch id that cannot be used as a key", async () => {
    const store = new MemoryIdempotencyStore();
    await expect(handleImportBatch(batch({ batchId: "bad id" }), store)).rejects.toBeInstanceOf(UnrecoverableJobError);
  });

  it("sends a notice once", async () => {
    const store = new MemoryIdempotencyStore();
    expect(await handleSendNotice(notice(), store)).toMatchObject({ delivered: true, duplicate: false });
    expect(await handleSendNotice(notice(), store)).toMatchObject({ delivered: false, duplicate: true });
    await expect(handleSendNotice({ ...notice(), to: "desk" }, store)).rejects.toBeInstanceOf(UnrecoverableJobError);
  });

  it("retries a transient feed until the attempt budget for the blip is past", async () => {
    expect(feedNeedsRetry({ outcome: "transient", attemptsMade: 1, succeedAfter: 3, released: false })).toBe(true);
    expect(feedNeedsRetry({ outcome: "transient", attemptsMade: 3, succeedAfter: 3, released: false })).toBe(false);
    expect(feedNeedsRetry({ outcome: "outage", attemptsMade: 4, succeedAfter: 3, released: false })).toBe(true);
    expect(feedNeedsRetry({ outcome: "outage", attemptsMade: 1, succeedAfter: 3, released: true })).toBe(false);

    const store = new MemoryIdempotencyStore();
    await expect(handleFeedSync(feed("transient"), 1, store)).rejects.toBeInstanceOf(RetryableJobError);
    const done = await handleFeedSync(feed("transient"), 3, store);
    expect(done).toMatchObject({ accepted: true, duplicate: false, attemptsMade: 3 });
  });

  it("keeps an outage failing until the feed is released", async () => {
    const store = new MemoryIdempotencyStore();
    await expect(handleFeedSync(feed("outage"), 1, store)).rejects.toBeInstanceOf(RetryableJobError);
    await releaseFeed(store, "feed-1");
    const done = await handleFeedSync(feed("outage"), 2, store);
    expect(done.accepted).toBe(true);
    expect(done.duplicate).toBe(false);
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

export const buildFingerprint = "background-jobs@0.1.0#test/processors.spec.ts";
