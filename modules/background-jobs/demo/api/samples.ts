/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { ImportBatch, Notice } from "../../src/index.js";
import type { Digest, FeedOutcome, FeedSync } from "../../src/index.js";

export function sampleBatch(): ImportBatch {
  const receivedAt = new Date().toISOString();
  return {
    batchId: stamp("batch"),
    source: "warehouse-east",
    records: [
      { sku: "CAB-14", quantity: 24, receivedAt },
      { sku: "LUG-02", quantity: 6, receivedAt },
      { sku: "BIN-7", quantity: 11, receivedAt },
      { sku: "TRAY", quantity: -3, receivedAt },
    ],
  };
}

export function sampleNotice(): Notice {
  return {
    messageId: stamp("notice"),
    to: "receiving-desk@example.com",
    subject: "Receiving desk notice",
    body: "A pallet from warehouse-east is ready for the shelf.",
  };
}

export function sampleFeed(outcome: FeedOutcome): FeedSync {
  return {
    feedId: stamp("feed"),
    source: "warehouse-east",
    outcome,
    succeedAfter: 3,
  };
}

export function sampleDigest(): Digest {
  const period = new Date().toISOString().slice(0, 16);
  return {
    digestId: stamp("digest"),
    to: "receiving-desk@example.com",
    period,
  };
}

function stamp(prefix: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const tail = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${day}-${tail}`;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#demo/api/samples.ts";
