/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { Producer } from "kafkajs";
import type { Pool } from "pg";
import type { KafkaStreamConfig } from "../config/kafka-config.js";
import { idempotencyTable } from "../db/schema.js";
import {
  asPayload,
  encodeRecord,
  HEADER_ATTEMPT,
  HEADER_EVENT_ID,
  HEADER_NOT_BEFORE,
  isPoison,
  shouldHold,
  type StreamRecord,
} from "./message.js";
import { decideAfterFailure } from "./retry-policy.js";

export type ProcessOutcome = "applied" | "duplicate" | "retry" | "dead" | "held";

export interface ProcessorDeps {
  pool: Pool;
  producer: Producer;
  config: KafkaStreamConfig;
}

const POISON_REASON = "poison payload";

/**
 * Applies a record once, or parks it behind an unfinished record for the same key.
 * A poison record walks the retry topics and then the dead-letter topic.
 */
export async function handleRecord(
  deps: ProcessorDeps,
  record: StreamRecord,
  attempt: number,
  draining = false,
): Promise<ProcessOutcome> {
  if (await alreadyHandled(deps, record.eventId)) {
    const gate = await readGate(deps, record.partitionKey);
    if (!gate || gate === record.eventId) {
      await clearGate(deps, record.partitionKey, record.eventId);
      if (!draining) await drain(deps, record.partitionKey);
    }
    return "duplicate";
  }

  const gate = await readGate(deps, record.partitionKey);
  if (shouldHold(gate, record.eventId)) {
    await hold(deps, record);
    return "held";
  }

  if (isPoison(record)) {
    await setGate(deps, record.partitionKey, record.eventId);
    const outcome = await routeFailure(deps, record, attempt, POISON_REASON);
    if (outcome === "dead") {
      await clearGate(deps, record.partitionKey, record.eventId);
      if (!draining) await drain(deps, record.partitionKey);
    }
    return outcome;
  }

  const outcome = await applyRecord(deps, record);
  await clearGate(deps, record.partitionKey, record.eventId);
  if (!draining) await drain(deps, record.partitionKey);
  return outcome;
}

async function drain(deps: ProcessorDeps, partitionKey: string): Promise<void> {
  for (let step = 0; step < 1000; step += 1) {
    if (await readGate(deps, partitionKey)) return;
    const next = await firstHeld(deps, partitionKey);
    if (!next) return;
    const outcome = await handleRecord(deps, next, 1, true);
    if (outcome !== "held") await deleteHeld(deps, next);
    if (outcome === "retry" || outcome === "held") return;
  }
}

async function routeFailure(
  deps: ProcessorDeps,
  record: StreamRecord,
  attempt: number,
  reason: string,
): Promise<"retry" | "dead"> {
  const decision = decideAfterFailure(attempt, deps.config);
  const alreadyPublished = await routeAlreadyPublished(deps, record.eventId, attempt);
  if (alreadyPublished) return decision.action;

  await rememberRoute(deps, record.eventId, attempt, decision.topic, decision.notBefore);
  const headers: Record<string, string> = {
    [HEADER_EVENT_ID]: record.eventId,
    [HEADER_ATTEMPT]: String(decision.nextAttempt ?? attempt),
  };
  if (decision.notBefore !== undefined) headers[HEADER_NOT_BEFORE] = String(decision.notBefore);
  await deps.producer.send({
    topic: decision.topic,
    acks: -1,
    messages: [
      {
        key: record.partitionKey,
        value: encodeRecord(record),
        headers,
      },
    ],
  });

  const client = await deps.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE delivery_routes
       SET published_at = now()
       WHERE event_id = $1 AND attempt = $2 AND published_at IS NULL`,
      [record.eventId, attempt],
    );
    if (decision.action === "dead") {
      await client.query(
        `INSERT INTO dead_letters (event_id, partition_key, sequence, attempts, reason, payload)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (event_id) DO NOTHING`,
        [
          record.eventId,
          record.partitionKey,
          record.sequence,
          attempt,
          reason,
          JSON.stringify(record.payload),
        ],
      );
      await client.query(
        `INSERT INTO ${idempotencyTable(deps.config)}
           (event_id, consumer_group, outcome, expires_at)
         VALUES ($1, $2, 'dead', now() + make_interval(secs => $3::int))
         ON CONFLICT (event_id, consumer_group)
         DO UPDATE SET outcome = 'dead', processed_at = now(), expires_at = EXCLUDED.expires_at`,
        [record.eventId, deps.config.consumerGroup, deps.config.idempotency.ttlSeconds],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return decision.action;
}

async function applyRecord(deps: ProcessorDeps, record: StreamRecord): Promise<"applied" | "duplicate"> {
  const client = await deps.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM ${idempotencyTable(deps.config)}
       WHERE event_id = $1 AND consumer_group = $2 AND expires_at <= now()`,
      [record.eventId, deps.config.consumerGroup],
    );
    const inserted = await client.query(
      `INSERT INTO ${idempotencyTable(deps.config)}
         (event_id, consumer_group, outcome, expires_at)
       VALUES ($1, $2, 'processed', now() + make_interval(secs => $3::int))
       ON CONFLICT DO NOTHING
       RETURNING event_id`,
      [record.eventId, deps.config.consumerGroup, deps.config.idempotency.ttlSeconds],
    );
    if ((inserted.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return "duplicate";
    }
    await client.query(
      `INSERT INTO applied_events (event_id, partition_key, sequence, event_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING`,
      [record.eventId, record.partitionKey, record.sequence, record.eventType],
    );
    await client.query("COMMIT");
    return "applied";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function alreadyHandled(deps: ProcessorDeps, eventId: string): Promise<boolean> {
  const result = await deps.pool.query(
    `SELECT 1
     FROM ${idempotencyTable(deps.config)}
     WHERE event_id = $1 AND consumer_group = $2 AND expires_at > now()`,
    [eventId, deps.config.consumerGroup],
  );
  return (result.rowCount ?? 0) > 0;
}

async function readGate(deps: ProcessorDeps, partitionKey: string): Promise<string | null> {
  const result = await deps.pool.query<{ event_id: string }>(
    `SELECT event_id FROM key_gates WHERE partition_key = $1`,
    [partitionKey],
  );
  return result.rows[0]?.event_id ?? null;
}

async function setGate(deps: ProcessorDeps, partitionKey: string, eventId: string): Promise<void> {
  await deps.pool.query(
    `INSERT INTO key_gates (partition_key, event_id)
     VALUES ($1, $2)
     ON CONFLICT (partition_key)
     DO UPDATE SET event_id = EXCLUDED.event_id
     WHERE key_gates.event_id = EXCLUDED.event_id`,
    [partitionKey, eventId],
  );
}

async function clearGate(deps: ProcessorDeps, partitionKey: string, eventId: string): Promise<void> {
  await deps.pool.query(`DELETE FROM key_gates WHERE partition_key = $1 AND event_id = $2`, [
    partitionKey,
    eventId,
  ]);
}

async function hold(deps: ProcessorDeps, record: StreamRecord): Promise<void> {
  await deps.pool.query(
    `INSERT INTO held_events (partition_key, sequence, record)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT DO NOTHING`,
    [record.partitionKey, record.sequence, JSON.stringify(record)],
  );
}

async function firstHeld(deps: ProcessorDeps, partitionKey: string): Promise<StreamRecord | null> {
  const result = await deps.pool.query<{ record: unknown }>(
    `SELECT record
     FROM held_events
     WHERE partition_key = $1
     ORDER BY sequence
     LIMIT 1`,
    [partitionKey],
  );
  const raw = result.rows[0]?.record;
  if (!raw) return null;
  const body = asPayload(raw);
  return {
    eventId: String(body.eventId),
    partitionKey: String(body.partitionKey),
    sequence: Number(body.sequence),
    eventType: String(body.eventType),
    payload: asPayload(body.payload),
  };
}

async function deleteHeld(deps: ProcessorDeps, record: StreamRecord): Promise<void> {
  await deps.pool.query(`DELETE FROM held_events WHERE partition_key = $1 AND sequence = $2`, [
    record.partitionKey,
    record.sequence,
  ]);
}

async function routeAlreadyPublished(deps: ProcessorDeps, eventId: string, attempt: number): Promise<boolean> {
  const result = await deps.pool.query(
    `SELECT published_at FROM delivery_routes WHERE event_id = $1 AND attempt = $2`,
    [eventId, attempt],
  );
  return Boolean(result.rows[0]?.published_at);
}

async function rememberRoute(
  deps: ProcessorDeps,
  eventId: string,
  attempt: number,
  destination: string,
  notBefore: number | undefined,
): Promise<void> {
  await deps.pool.query(
    `INSERT INTO delivery_routes (event_id, attempt, destination, not_before)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_id, attempt) DO NOTHING`,
    [eventId, attempt, destination, notBefore === undefined ? null : new Date(notBefore)],
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

export const buildFingerprint = "kafka-event-stream@0.1.0#src/pipeline/process.ts";
