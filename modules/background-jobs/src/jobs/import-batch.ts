/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { IdempotencyStore } from "../queue/idempotency.js";
import { UnrecoverableJobError } from "../queue/policy.js";

export interface BatchRecord {
  sku: string;
  quantity: number;
  receivedAt: string;
}

/** A receiving file from one warehouse. Bad lines are counted and skipped. */
export interface ImportBatch {
  batchId: string;
  source: string;
  records: BatchRecord[];
}

export interface ImportResult {
  batchId: string;
  accepted: number;
  rejected: number;
  duplicate: boolean;
}

const idPattern = /^[A-Za-z0-9._-]{1,80}$/;
const sourcePattern = /^[A-Za-z0-9 ._-]{1,80}$/;
const skuPattern = /^[A-Z0-9-]{1,20}$/;

export function assertImportBatch(batch: ImportBatch): void {
  if (!batch || typeof batch !== "object") throw new UnrecoverableJobError("batch payload is missing.");
  if (typeof batch.batchId !== "string" || !idPattern.test(batch.batchId)) {
    throw new UnrecoverableJobError("batchId must be 1 to 80 letters, digits, '.', '_' or '-'.");
  }
  if (typeof batch.source !== "string" || !sourcePattern.test(batch.source)) {
    throw new UnrecoverableJobError("source must be 1 to 80 letters, digits, spaces, '.', '_' or '-'.");
  }
  if (!Array.isArray(batch.records) || batch.records.length < 1 || batch.records.length > 500) {
    throw new UnrecoverableJobError("records must hold between 1 and 500 lines.");
  }
  for (const record of batch.records) {
    if (!record || typeof record !== "object") throw new UnrecoverableJobError("each record must be an object.");
  }
}

export function tallyBatch(batch: ImportBatch): { accepted: number; rejected: number } {
  let accepted = 0;
  let rejected = 0;
  for (const record of batch.records) {
    if (acceptRecord(record)) accepted += 1;
    else rejected += 1;
  }
  return { accepted, rejected };
}

export async function handleImportBatch(batch: ImportBatch, store: IdempotencyStore): Promise<ImportResult> {
  assertImportBatch(batch);
  const key = `import-batch:${batch.batchId}`;
  if (await store.has(key)) {
    return { batchId: batch.batchId, accepted: 0, rejected: 0, duplicate: true };
  }
  const counts = tallyBatch(batch);
  await store.mark(key);
  return { batchId: batch.batchId, ...counts, duplicate: false };
}

function acceptRecord(record: BatchRecord): boolean {
  if (typeof record.sku !== "string" || !skuPattern.test(record.sku)) return false;
  if (!Number.isInteger(record.quantity) || record.quantity < 0 || record.quantity > 1_000_000) return false;
  if (typeof record.receivedAt !== "string" || Number.isNaN(Date.parse(record.receivedAt))) return false;
  return true;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#src/jobs/import-batch.ts";
