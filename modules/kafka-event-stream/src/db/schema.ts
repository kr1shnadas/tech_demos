/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { assertSqlIdentifier, type KafkaStreamConfig } from "../config/kafka-config.js";

export function outboxTable(config: KafkaStreamConfig): string {
  return assertSqlIdentifier(config.outbox.table, "outbox.table");
}

export function idempotencyTable(config: KafkaStreamConfig): string {
  return assertSqlIdentifier(config.idempotency.table, "idempotency.table");
}

/** Tables the pipeline owns. Identifiers are checked before they are interpolated. */
export function schemaSql(config: KafkaStreamConfig): string {
  const outbox = outboxTable(config);
  const processed = idempotencyTable(config);
  return `
CREATE TABLE IF NOT EXISTS partition_sequences (
  partition_key TEXT PRIMARY KEY,
  last_sequence BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS ${outbox} (
  id TEXT PRIMARY KEY,
  partition_key TEXT NOT NULL,
  sequence BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  UNIQUE (partition_key, sequence)
);

CREATE TABLE IF NOT EXISTS ${processed} (
  event_id TEXT NOT NULL,
  consumer_group TEXT NOT NULL,
  outcome TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (event_id, consumer_group)
);

CREATE TABLE IF NOT EXISTS applied_events (
  position BIGSERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  partition_key TEXT NOT NULL,
  sequence BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dead_letters (
  event_id TEXT PRIMARY KEY,
  partition_key TEXT NOT NULL,
  sequence BIGINT NOT NULL,
  attempts INTEGER NOT NULL,
  reason TEXT NOT NULL,
  payload JSONB NOT NULL,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_routes (
  event_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  destination TEXT NOT NULL,
  not_before TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, attempt)
);

CREATE TABLE IF NOT EXISTS key_gates (
  partition_key TEXT PRIMARY KEY,
  event_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS held_events (
  partition_key TEXT NOT NULL,
  sequence BIGINT NOT NULL,
  record JSONB NOT NULL,
  PRIMARY KEY (partition_key, sequence)
);
`;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#src/db/schema.ts";
