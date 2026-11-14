/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { IdempotencyStore } from "../queue/idempotency.js";
import { RetryableJobError, UnrecoverableJobError } from "../queue/policy.js";

export type FeedOutcome = "transient" | "outage" | "ok";

/**
 * A push of the day's receipts to the central warehouse.
 * `transient` fails until `succeedAfter`, then succeeds.
 * `outage` keeps failing until an operator marks the feed released.
 */
export interface FeedSync {
  feedId: string;
  source: string;
  outcome: FeedOutcome;
  succeedAfter: number;
}

export interface FeedSyncResult {
  feedId: string;
  accepted: boolean;
  duplicate: boolean;
  attemptsMade: number;
}

const idPattern = /^[A-Za-z0-9._-]{1,80}$/;
const sourcePattern = /^[A-Za-z0-9 ._-]{1,80}$/;
const outcomes = new Set<FeedOutcome>(["transient", "outage", "ok"]);

export function assertFeedSync(feed: FeedSync): void {
  if (!feed || typeof feed !== "object") throw new UnrecoverableJobError("feed payload is missing.");
  if (typeof feed.feedId !== "string" || !idPattern.test(feed.feedId)) {
    throw new UnrecoverableJobError("feedId must be 1 to 80 letters, digits, '.', '_' or '-'.");
  }
  if (typeof feed.source !== "string" || !sourcePattern.test(feed.source)) {
    throw new UnrecoverableJobError("source must be 1 to 80 letters, digits, spaces, '.', '_' or '-'.");
  }
  if (!outcomes.has(feed.outcome)) throw new UnrecoverableJobError("outcome must be transient, outage or ok.");
  if (!Number.isInteger(feed.succeedAfter) || feed.succeedAfter < 1 || feed.succeedAfter > 25) {
    throw new UnrecoverableJobError("succeedAfter must be an integer from 1 to 25.");
  }
}

/** True while the warehouse should still reject this attempt. */
export function feedNeedsRetry(input: {
  outcome: FeedOutcome;
  attemptsMade: number;
  succeedAfter: number;
  released: boolean;
}): boolean {
  if (input.released || input.outcome === "ok") return false;
  if (input.outcome === "transient") return input.attemptsMade < input.succeedAfter;
  return true;
}

export function feedFailureMessage(outcome: FeedOutcome): string {
  return outcome === "transient" ? "warehouse feed returned 503" : "warehouse feed returned 500";
}

export function releaseKey(feedId: string): string {
  return `released:${feedId}`;
}

export async function releaseFeed(store: IdempotencyStore, feedId: string): Promise<void> {
  if (!idPattern.test(feedId)) throw new UnrecoverableJobError("feedId must be 1 to 80 letters, digits, '.', '_' or '-'.");
  await store.mark(releaseKey(feedId));
}

export async function handleFeedSync(
  feed: FeedSync,
  attemptsMade: number,
  store: IdempotencyStore,
): Promise<FeedSyncResult> {
  assertFeedSync(feed);
  const doneKey = `sync-feed:${feed.feedId}`;
  if (await store.has(doneKey)) {
    return { feedId: feed.feedId, accepted: true, duplicate: true, attemptsMade };
  }
  const released = feed.outcome === "outage" && (await store.has(releaseKey(feed.feedId)));
  if (feedNeedsRetry({ outcome: feed.outcome, attemptsMade, succeedAfter: feed.succeedAfter, released })) {
    throw new RetryableJobError(feedFailureMessage(feed.outcome));
  }
  await store.mark(doneKey);
  return { feedId: feed.feedId, accepted: true, duplicate: false, attemptsMade };
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#src/jobs/sync-feed.ts";
