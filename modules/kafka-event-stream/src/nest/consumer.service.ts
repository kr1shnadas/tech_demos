/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Kafka, logLevel, type Consumer } from "kafkajs";
import { retryTopicNames, type KafkaStreamConfig } from "../config/kafka-config.js";
import { outboxTable } from "../db/schema.js";
import {
  decodeRecord,
  readAttempt,
  readNotBefore,
  type StreamRecord,
} from "../pipeline/message.js";
import { handleRecord, type ProcessOutcome } from "../pipeline/process.js";
import { STREAM_CONTEXT } from "./tokens.js";
import { StreamContext } from "./stream-context.js";

export interface LagPartition {
  partition: number;
  endOffset: string;
  committed: string;
  lag: number;
}

export interface AppliedView {
  eventId: string;
  partitionKey: string;
  sequence: number;
  eventType: string;
  appliedAt: string;
}

export interface RouteView {
  eventId: string;
  attempt: number;
  destination: string;
  createdAt: string;
}

export interface DeadLetterView {
  eventId: string;
  partitionKey: string;
  sequence: number;
  attempts: number;
  reason: string;
  failedAt: string;
}

export interface StreamStatus {
  service: string;
  consumerGroup: string;
  topics: {
    events: string;
    retries: string[];
    deadLetter: string;
  };
  outbox: { pending: number; published: number };
  lag: { total: number; partitions: LagPartition[] };
  events: AppliedView[];
  retries: RouteView[];
  deadLetters: DeadLetterView[];
}

export interface ReplayRequest {
  topic?: string;
  partition?: number;
  offset: string;
  limit?: number;
}

export interface ReplayHit {
  eventId: string;
  partition: number;
  offset: string;
  outcome: ProcessOutcome;
}

export interface ReplayResult {
  topic: string;
  fromOffset: string;
  read: number;
  applied: number;
  duplicates: number;
  dead: number;
  retried: number;
  held: number;
  hits: ReplayHit[];
}

@Injectable()
export class ConsumerService {
  private consumer: Consumer | undefined;
  private stopped = true;

  constructor(@Inject(STREAM_CONTEXT) private readonly context: StreamContext) {}

  get config(): KafkaStreamConfig {
    return this.context.config;
  }

  async start(): Promise<void> {
    if (this.consumer) return;
    this.stopped = false;
    const topics = [this.config.topics.events, ...retryTopicNames(this.config)];
    const consumer = this.context.kafka.consumer({
      groupId: this.config.consumerGroup,
      sessionTimeout: 15_000,
      heartbeatInterval: 3_000,
      allowAutoTopicCreation: false,
    });
    await consumer.connect();
    await consumer.subscribe({ topics, fromBeginning: true });
    const concurrency = Math.max(1, this.config.partitions * topics.length);
    const running = consumer.run({
      partitionsConsumedConcurrently: concurrency,
      eachMessage: async ({ message, heartbeat }) => {
        if (this.stopped) return;
        const notBefore = readNotBefore(message.headers);
        if (notBefore !== undefined && notBefore > Date.now()) {
          await sleepUntil(notBefore, heartbeat);
        }
        const record = decodeRecord(message.value);
        await handleRecord(
          { pool: this.context.pool, producer: this.context.producer, config: this.config },
          record,
          readAttempt(message.headers),
        );
      },
    });
    void running.catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!this.stopped) console.error(`consumer stopped: ${message}`);
    });
    this.consumer = consumer;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    const consumer = this.consumer;
    this.consumer = undefined;
    if (!consumer) return;
    await Promise.race([
      consumer.stop().catch(() => undefined),
      sleep(2_000),
    ]);
    await consumer.disconnect().catch(() => undefined);
  }

  async status(): Promise<StreamStatus> {
    const [outbox, events, retries, deadLetters, lag] = await Promise.all([
      this.outboxCounts(),
      this.recentEvents(),
      this.recentRetries(),
      this.recentDeadLetters(),
      this.lag(),
    ]);
    return {
      service: "kafka-event-stream",
      consumerGroup: this.config.consumerGroup,
      topics: {
        events: this.config.topics.events,
        retries: retryTopicNames(this.config),
        deadLetter: this.config.topics.deadLetter,
      },
      outbox,
      lag,
      events,
      retries,
      deadLetters,
    };
  }

  /**
   * Reads the log again from an offset and runs the same handler.
   * An event the group already finished comes back as a duplicate.
   */
  async replay(request: ReplayRequest): Promise<ReplayResult> {
    const topic = request.topic ?? this.config.topics.events;
    const limit = request.limit ?? 100;
    const from = BigInt(request.offset);
    const ends = await this.context.admin.fetchTopicOffsets(topic);
    const targets = new Map<number, bigint>();
    for (const entry of ends) {
      if (request.partition !== undefined && entry.partition !== request.partition) continue;
      const end = BigInt(entry.high ?? entry.offset);
      if (end > from) targets.set(entry.partition, end);
    }
    const empty: ReplayResult = {
      topic,
      fromOffset: request.offset,
      read: 0,
      applied: 0,
      duplicates: 0,
      dead: 0,
      retried: 0,
      held: 0,
      hits: [],
    };
    if (targets.size === 0) return empty;

    // Replay uses its own client. The running consumer keeps its group.
    const kafka = new Kafka({
      clientId: `${this.config.clientId}-replay`,
      brokers: [...this.config.brokers],
      logLevel: logLevel.NOTHING,
      connectionTimeout: 5_000,
      retry: { retries: 5, initialRetryTime: 200 },
    });
    const consumer = kafka.consumer({
      groupId: `${this.config.consumerGroup}.replay.${randomUUID()}`,
      sessionTimeout: 10_000,
      heartbeatInterval: 2_000,
      allowAutoTopicCreation: false,
    });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });
    const hits: ReplayHit[] = [];
    const seen = new Set<string>();
    const finished = new Set<number>();
    let resolveDone: () => void = () => undefined;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });
    const timer = setTimeout(() => resolveDone(), 12_000);
    consumer.on(consumer.events.GROUP_JOIN, (event) => {
      if (request.offset === "0") return;
      const assigned = event.payload.memberAssignment[topic] ?? [];
      for (const partition of assigned) {
        if (!targets.has(partition)) continue;
        try {
          consumer.seek({ topic, partition, offset: request.offset });
        } catch {
          // Records before the requested offset are ignored in the handler.
        }
      }
    });
    const running = consumer.run({
      eachMessage: async ({ partition, message }) => {
        if (hits.length >= limit) return;
        if (!targets.has(partition)) return;
        const offset = BigInt(message.offset);
        const end = targets.get(partition);
        if (end === undefined || offset < from || offset >= end) return;
        const key = `${partition}:${message.offset}`;
        if (seen.has(key)) return;
        seen.add(key);
        let record: StreamRecord;
        try {
          record = decodeRecord(message.value);
        } catch {
          return;
        }
        const outcome = await handleRecord(
          { pool: this.context.pool, producer: this.context.producer, config: this.config },
          record,
          readAttempt(message.headers),
        );
        hits.push({ eventId: record.eventId, partition, offset: message.offset, outcome });
        if (offset + 1n >= end) finished.add(partition);
        if (hits.length >= limit || finished.size === targets.size) {
          clearTimeout(timer);
          resolveDone();
        }
      },
    });
    try {
      await done;
    } finally {
      clearTimeout(timer);
      await Promise.race([consumer.stop().catch(() => undefined), sleep(2_000)]);
      await consumer.disconnect().catch(() => undefined);
      await Promise.race([running.catch(() => undefined), sleep(2_000)]);
    }
    return {
      ...empty,
      read: hits.length,
      applied: hits.filter((hit) => hit.outcome === "applied").length,
      duplicates: hits.filter((hit) => hit.outcome === "duplicate").length,
      dead: hits.filter((hit) => hit.outcome === "dead").length,
      retried: hits.filter((hit) => hit.outcome === "retry").length,
      held: hits.filter((hit) => hit.outcome === "held").length,
      hits,
    };
  }

  private async outboxCounts(): Promise<{ pending: number; published: number }> {
    const result = await this.context.pool.query<{ pending: string; published: string }>(
      `SELECT
         count(*) FILTER (WHERE published_at IS NULL) AS pending,
         count(*) FILTER (WHERE published_at IS NOT NULL) AS published
       FROM ${outboxTable(this.config)}`,
    );
    return {
      pending: Number(result.rows[0]?.pending ?? 0),
      published: Number(result.rows[0]?.published ?? 0),
    };
  }

  private async recentEvents(): Promise<AppliedView[]> {
    const result = await this.context.pool.query<{
      event_id: string;
      partition_key: string;
      sequence: string;
      event_type: string;
      applied_at: Date;
    }>(
      `SELECT event_id, partition_key, sequence, event_type, applied_at
       FROM applied_events
       ORDER BY position DESC
       LIMIT 20`,
    );
    return result.rows.map((row) => ({
      eventId: row.event_id,
      partitionKey: row.partition_key,
      sequence: Number(row.sequence),
      eventType: row.event_type,
      appliedAt: new Date(row.applied_at).toISOString(),
    }));
  }

  private async recentRetries(): Promise<RouteView[]> {
    const result = await this.context.pool.query<{
      event_id: string;
      attempt: number;
      destination: string;
      created_at: Date;
    }>(
      `SELECT event_id, attempt, destination, created_at
       FROM delivery_routes
       WHERE destination <> $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [this.config.topics.deadLetter],
    );
    return result.rows.map((row) => ({
      eventId: row.event_id,
      attempt: row.attempt,
      destination: row.destination,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  private async recentDeadLetters(): Promise<DeadLetterView[]> {
    const result = await this.context.pool.query<{
      event_id: string;
      partition_key: string;
      sequence: string;
      attempts: number;
      reason: string;
      failed_at: Date;
    }>(
      `SELECT event_id, partition_key, sequence, attempts, reason, failed_at
       FROM dead_letters
       ORDER BY failed_at DESC
       LIMIT 20`,
    );
    return result.rows.map((row) => ({
      eventId: row.event_id,
      partitionKey: row.partition_key,
      sequence: Number(row.sequence),
      attempts: row.attempts,
      reason: row.reason,
      failedAt: new Date(row.failed_at).toISOString(),
    }));
  }

  private async lag(): Promise<{ total: number; partitions: LagPartition[] }> {
    try {
      const ends = await this.context.admin.fetchTopicOffsets(this.config.topics.events);
      let committed = new Map<number, bigint>();
      try {
        const groups = await this.context.admin.fetchOffsets({
          groupId: this.config.consumerGroup,
          topics: [this.config.topics.events],
        });
        const match = groups.find((group) => group.topic === this.config.topics.events);
        committed = new Map(
          (match?.partitions ?? []).map((part) => [part.partition, BigInt(part.offset)]),
        );
      } catch {
        committed = new Map();
      }
      const partitions = ends.map((entry) => {
        const end = BigInt(entry.high ?? entry.offset);
        const commit = committed.get(entry.partition) ?? -1n;
        const lag = lagBetween(end, commit);
        return {
          partition: entry.partition,
          endOffset: end.toString(),
          committed: commit < 0n ? "0" : commit.toString(),
          lag,
        };
      });
      return { total: partitions.reduce((sum, part) => sum + part.lag, 0), partitions };
    } catch {
      return { total: 0, partitions: [] };
    }
  }
}

function lagBetween(end: bigint, committed: bigint): number {
  const start = committed < 0n ? 0n : committed;
  const behind = end - start;
  return behind > 0n ? Number(behind) : 0;
}

async function sleepUntil(epochMs: number, heartbeat: () => Promise<void>): Promise<void> {
  while (Date.now() < epochMs) {
    await heartbeat();
    const remaining = epochMs - Date.now();
    if (remaining <= 0) return;
    await sleep(Math.min(remaining, 250));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#src/nest/consumer.service.ts";
