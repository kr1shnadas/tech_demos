/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import {
  retryTopicName,
  type KafkaStreamConfig,
} from "../config/kafka-config.js";

export interface AttemptDecision {
  action: "retry" | "dead";
  /** Attempt that just failed. */
  attempt: number;
  /** Topic the failed record is handed to. */
  topic: string;
  /** Attempt stamped on the next record. Set for a retry. */
  nextAttempt?: number;
  /** Epoch milliseconds. The retry consumer waits until this instant. */
  notBefore?: number;
}

export function backoffMs(attempt: number, config: KafkaStreamConfig): number {
  const power = config.retry.multiplier ** Math.max(0, attempt - 1);
  return Math.round(config.retry.backoffMs * power);
}

/**
 * Maps a failed attempt onto the next retry topic, or the dead-letter topic
 * once `maxAttempts` is used up.
 */
export function decideAfterFailure(
  attempt: number,
  config: KafkaStreamConfig,
  now = Date.now(),
): AttemptDecision {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error("attempt must be a positive integer.");
  }
  if (attempt >= config.retry.maxAttempts) {
    return { action: "dead", attempt, topic: config.topics.deadLetter };
  }
  return {
    action: "retry",
    attempt,
    topic: retryTopicName(config, attempt),
    nextAttempt: attempt + 1,
    notBefore: now + backoffMs(attempt, config),
  };
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#src/pipeline/retry-policy.ts";
