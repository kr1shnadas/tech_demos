/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { randomUUID } from "node:crypto";
import type { Producer } from "kafkajs";
import type { Pool, PoolClient } from "pg";
import type { KafkaStreamConfig } from "../config/kafka-config.js";
import { outboxTable } from "../db/schema.js";
import {
  asPayload,
  encodeRecord,
  HEADER_ATTEMPT,
  HEADER_EVENT_ID,
  type StreamRecord,
} from "./message.js";

export interface EnqueueInput {
  eventId?: string;
  partitionKey: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export async function withTransaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Inserts the outbox row in the caller's transaction.
 * A rollback removes the row, so the relay never sees it.
 */
export async function enqueueInTransaction(
  client: PoolClient,
  config: KafkaStreamConfig,
  input: EnqueueInput,
): Promise<StreamRecord> {
  const partitionKey = input.partitionKey.trim();
  if (!partitionKey) throw new Error("partitionKey is required.");
  const eventType = input.eventType.trim();
  if (!eventType) throw new Error("eventType is required.");
  const eventId = input.eventId?.trim() || randomUUID();
  const sequence = await nextSequence(client, partitionKey);
  const record: StreamRecord = {
    eventId,
    partitionKey,
    sequence,
    eventType,
    payload: input.payload,
  };
  await client.query(
    `INSERT INTO ${outboxTable(config)} (id, partition_key, sequence, event_type, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [record.eventId, record.partitionKey, record.sequence, record.eventType, JSON.stringify(record.payload)],
  );
  return record;
}

/**
 * Publishes unpublished rows in sequence order.
 * The row stays unpublished until the broker accepts the record, so a crash
 * publishes it again. The consumer treats that second copy as a duplicate.
 */
export async function publishPending(
  pool: Pool,
  producer: Producer,
  config: KafkaStreamConfig,
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pending = await client.query<{
      id: string;
      partition_key: string;
      sequence: string;
      event_type: string;
      payload: unknown;
    }>(
      `SELECT id, partition_key, sequence, event_type, payload
       FROM ${outboxTable(config)}
       WHERE published_at IS NULL
       ORDER BY sequence
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [config.outbox.batchSize],
    );
    for (const row of pending.rows) {
      const record: StreamRecord = {
        eventId: row.id,
        partitionKey: row.partition_key,
        sequence: Number(row.sequence),
        eventType: row.event_type,
        payload: asPayload(row.payload),
      };
      await producer.send({
        topic: config.topics.events,
        acks: -1,
        messages: [
          {
            key: record.partitionKey,
            value: encodeRecord(record),
            headers: {
              [HEADER_EVENT_ID]: record.eventId,
              [HEADER_ATTEMPT]: "1",
            },
          },
        ],
      });
      await client.query(`UPDATE ${outboxTable(config)} SET published_at = now() WHERE id = $1`, [record.eventId]);
    }
    await client.query("COMMIT");
    return pending.rowCount ?? pending.rows.length;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function nextSequence(client: PoolClient, partitionKey: string): Promise<number> {
  const result = await client.query<{ last_sequence: string }>(
    `INSERT INTO partition_sequences (partition_key, last_sequence)
     VALUES ($1, 1)
     ON CONFLICT (partition_key)
     DO UPDATE SET last_sequence = partition_sequences.last_sequence + 1
     RETURNING last_sequence`,
    [partitionKey],
  );
  return Number(result.rows[0]?.last_sequence);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#src/pipeline/outbox.ts";
