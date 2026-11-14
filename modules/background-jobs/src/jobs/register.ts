/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { JobContext } from "../queue/contracts.js";
import type { IdempotencyStore } from "../queue/idempotency.js";
import type { QueueRegistration } from "../queue/runtime.js";
import { handleImportBatch, type ImportBatch } from "./import-batch.js";
import { ingestionQueue, notificationQueue } from "./queues.js";
import { handleSendDigest, handleSendNotice, type Digest, type Notice } from "./send-notice.js";
import { handleFeedSync, type FeedSync } from "./sync-feed.js";

export function queueRegistrations(store: IdempotencyStore): QueueRegistration[] {
  return [
    {
      spec: ingestionQueue,
      handlers: {
        "import-batch": (ctx: JobContext<unknown>) => handleImportBatch(ctx.data as ImportBatch, store),
        "sync-feed": (ctx: JobContext<unknown>) => handleFeedSync(ctx.data as FeedSync, ctx.attemptsMade, store),
      },
    },
    {
      spec: notificationQueue,
      handlers: {
        "send-notice": (ctx: JobContext<unknown>) => handleSendNotice(ctx.data as Notice, store),
        "send-digest": (ctx: JobContext<unknown>) => handleSendDigest(ctx.data as Digest, store),
      },
    },
  ];
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#src/jobs/register.ts";
