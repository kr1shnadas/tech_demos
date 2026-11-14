/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { defineJob, defineQueue } from "../queue/contracts.js";
import type { ImportBatch, ImportResult } from "./import-batch.js";
import type { Digest, Notice, NoticeResult } from "./send-notice.js";
import type { FeedSync, FeedSyncResult } from "./sync-feed.js";

export const importBatchJob = defineJob<ImportBatch, ImportResult>("import-batch");
export const syncFeedJob = defineJob<FeedSync, FeedSyncResult>("sync-feed");
export const sendNoticeJob = defineJob<Notice, NoticeResult>("send-notice");
export const sendDigestJob = defineJob<Digest, NoticeResult>("send-digest");

export const ingestionQueue = defineQueue("ingestion", {
  "import-batch": importBatchJob,
  "sync-feed": syncFeedJob,
});

export const notificationQueue = defineQueue("notification", {
  "send-notice": sendNoticeJob,
  "send-digest": sendDigestJob,
});

export type IngestionJobs = (typeof ingestionQueue)["jobs"];
export type NotificationJobs = (typeof notificationQueue)["jobs"];

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#src/jobs/queues.ts";
