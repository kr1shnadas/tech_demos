/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export { moduleVersion } from "./credit.js";
export {
  defaultJobsConfig,
  defineJobsConfig,
  assertJobsConfig,
  assertQueueName,
  type BackoffSettings,
  type BackoffType,
  type HealthPaths,
  type JobDefaults,
  type JobsConfig,
  type JobsConfigOverrides,
  type RedisSettings,
  type WorkerSettings,
} from "./config/jobs-config.js";
export { loadJobsConfig } from "./config/load-config.js";
export {
  defineJob,
  defineQueue,
  type JobContext,
  type JobDataOf,
  type JobHandler,
  type JobResultOf,
  type JobSpec,
  type QueueSpec,
} from "./queue/contracts.js";
export {
  JobNotFoundError,
  RetryableJobError,
  UnknownJobError,
  UnrecoverableJobError,
  assertCronPattern,
  assertIdempotencyKey,
  assertSchedulerKey,
  backoffDelayMs,
  shouldDeadLetter,
  type FailureFacts,
} from "./queue/policy.js";
export {
  bullConnection,
  commandConnection,
  defaultJobOptions,
  describeWorker,
  retention,
  workerSettings,
  type WorkerOverride,
} from "./queue/options.js";
export { MemoryIdempotencyStore, RedisIdempotencyStore } from "./queue/idempotency.js";
export type { Closable, IdempotencyStore } from "./queue/idempotency.js";
export {
  QueueProducer,
  type EnqueueOptions,
  type EnqueuedJob,
  type ScheduleOptions,
} from "./queue/producer.js";
export {
  JobRuntime,
  assertRegistrations,
  type ActivityEntry,
  type ActivityKind,
  type BoardSnapshot,
  type DeadLetterRecord,
  type DeadLetterRow,
  type FailedRow,
  type QueueCounts,
  type QueueRegistration,
} from "./queue/runtime.js";
export { readiness, type ReadinessReport } from "./health/health.js";
export { IDEMPOTENCY_STORE, JOBS_CONFIG, JOBS_RUNTIME } from "./nest/tokens.js";
export { JobsModule, type JobsModuleOptions } from "./nest/jobs.module.js";
export {
  handleImportBatch,
  assertImportBatch,
  tallyBatch,
  type BatchRecord,
  type ImportBatch,
  type ImportResult,
} from "./jobs/import-batch.js";
export {
  handleSendDigest,
  handleSendNotice,
  assertDigest,
  assertNotice,
  type Digest,
  type Notice,
  type NoticeResult,
} from "./jobs/send-notice.js";
export {
  handleFeedSync,
  assertFeedSync,
  feedFailureMessage,
  feedNeedsRetry,
  releaseFeed,
  releaseKey,
  type FeedOutcome,
  type FeedSync,
  type FeedSyncResult,
} from "./jobs/sync-feed.js";
export {
  importBatchJob,
  ingestionQueue,
  notificationQueue,
  sendDigestJob,
  sendNoticeJob,
  syncFeedJob,
  type IngestionJobs,
  type NotificationJobs,
} from "./jobs/queues.js";
export { queueRegistrations } from "./jobs/register.js";

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "background-jobs@0.1.0#src/index.ts";
