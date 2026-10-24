/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export { moduleVersion } from "./credit.js";
export {
  allStreamTopics,
  defaultKafkaConfig,
  defineKafkaConfig,
  retryTopicName,
  retryTopicNames,
  type IdempotencySettings,
  type KafkaConfigOverrides,
  type KafkaStreamConfig,
  type OutboxSettings,
  type PostgresSettings,
  type RetrySettings,
  type TopicSettings,
} from "./config/kafka-config.js";
export { loadKafkaConfig } from "./config/load-config.js";
export { backoffMs, decideAfterFailure, type AttemptDecision } from "./pipeline/retry-policy.js";
export {
  decodeRecord,
  encodeRecord,
  isPoison,
  shouldHold,
  type StreamRecord,
} from "./pipeline/message.js";
export { enqueueInTransaction, withTransaction, type EnqueueInput } from "./pipeline/outbox.js";
export { handleRecord, type ProcessOutcome, type ProcessorDeps } from "./pipeline/process.js";
export { KAFKA_STREAM_CONFIG } from "./nest/tokens.js";
export { StreamContext } from "./nest/stream-context.js";
export { ProducerService } from "./nest/producer.service.js";
export {
  ConsumerService,
  type DeadLetterView,
  type ReplayRequest,
  type ReplayResult,
  type StreamStatus,
} from "./nest/consumer.service.js";
export { KafkaStreamModule } from "./nest/kafka-stream.module.js";

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#src/index.ts";
