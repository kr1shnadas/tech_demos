/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { IdempotencyStore } from "../queue/idempotency.js";
import { UnrecoverableJobError } from "../queue/policy.js";

/** A notice for the receiving desk. The demo records it; a deployment would hand it to a mailer. */
export interface Notice {
  messageId: string;
  to: string;
  subject: string;
  body: string;
}

export interface Digest {
  digestId: string;
  to: string;
  period: string;
}

export interface NoticeResult {
  messageId: string;
  delivered: boolean;
  duplicate: boolean;
}

const idPattern = /^[A-Za-z0-9._-]{1,80}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function assertNotice(notice: Notice): void {
  if (!notice || typeof notice !== "object") throw new UnrecoverableJobError("notice payload is missing.");
  if (typeof notice.messageId !== "string" || !idPattern.test(notice.messageId)) {
    throw new UnrecoverableJobError("messageId must be 1 to 80 letters, digits, '.', '_' or '-'.");
  }
  if (typeof notice.to !== "string" || notice.to.length > 120 || !emailPattern.test(notice.to)) {
    throw new UnrecoverableJobError("notice requires an email address.");
  }
  if (typeof notice.subject !== "string" || notice.subject.trim().length < 1 || notice.subject.length > 140) {
    throw new UnrecoverableJobError("subject must be 1 to 140 characters.");
  }
  if (typeof notice.body !== "string" || notice.body.trim().length < 1 || notice.body.length > 4000) {
    throw new UnrecoverableJobError("body must be 1 to 4000 characters.");
  }
}

export function assertDigest(digest: Digest): void {
  if (!digest || typeof digest !== "object") throw new UnrecoverableJobError("digest payload is missing.");
  if (typeof digest.digestId !== "string" || !idPattern.test(digest.digestId)) {
    throw new UnrecoverableJobError("digestId must be 1 to 80 letters, digits, '.', '_' or '-'.");
  }
  if (typeof digest.to !== "string" || digest.to.length > 120 || !emailPattern.test(digest.to)) {
    throw new UnrecoverableJobError("digest requires an email address.");
  }
  if (typeof digest.period !== "string" || digest.period.trim().length < 1 || digest.period.length > 40) {
    throw new UnrecoverableJobError("period must be 1 to 40 characters.");
  }
}

export async function handleSendNotice(notice: Notice, store: IdempotencyStore): Promise<NoticeResult> {
  assertNotice(notice);
  const key = `send-notice:${notice.messageId}`;
  if (await store.has(key)) return { messageId: notice.messageId, delivered: false, duplicate: true };
  await store.mark(key);
  return { messageId: notice.messageId, delivered: true, duplicate: false };
}

export async function handleSendDigest(digest: Digest, store: IdempotencyStore): Promise<NoticeResult> {
  assertDigest(digest);
  return handleSendNotice(
    {
      messageId: digest.digestId,
      to: digest.to,
      subject: `Warehouse digest ${digest.period}`,
      body: `Receiving digest for ${digest.period}.`,
    },
    store,
  );
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#src/jobs/send-notice.ts";
