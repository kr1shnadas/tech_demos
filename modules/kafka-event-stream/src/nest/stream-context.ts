/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Inject, Injectable } from "@nestjs/common";
import { Kafka, Partitioners, logLevel, type Admin, type Producer } from "kafkajs";
import { Pool } from "pg";
import { allStreamTopics, type KafkaStreamConfig } from "../config/kafka-config.js";
import { schemaSql } from "../db/schema.js";
import { KAFKA_STREAM_CONFIG } from "./tokens.js";

@Injectable()
export class StreamContext {
  readonly pool: Pool;
  readonly kafka: Kafka;
  producer!: Producer;
  admin!: Admin;
  private started = false;

  constructor(@Inject(KAFKA_STREAM_CONFIG) readonly config: KafkaStreamConfig) {
    this.pool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      user: config.postgres.user,
      password: config.postgres.password,
      database: config.postgres.database,
      max: 8,
    });
    this.pool.on("error", () => undefined);
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: [...config.brokers],
      logLevel: logLevel.NOTHING,
      connectionTimeout: 5_000,
      requestTimeout: 15_000,
      retry: { retries: 8, initialRetryTime: 200 },
    });
  }

  async start(): Promise<void> {
    if (this.started) return;
    await this.pool.query(schemaSql(this.config));
    this.admin = this.kafka.admin();
    await this.admin.connect();
    const topics = allStreamTopics(this.config);
    await this.admin.createTopics({
      waitForLeaders: true,
      topics: topics.map((topic) => ({
        topic,
        numPartitions: this.config.partitions,
        replicationFactor: 1,
      })),
    });
    await waitForTopics(this.admin, topics);
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      idempotent: true,
      maxInFlightRequests: 1,
      createPartitioner: Partitioners.LegacyPartitioner,
    });
    await this.producer.connect();
    this.started = true;
  }

  async stop(): Promise<void> {
    this.started = false;
    await this.producer?.disconnect().catch(() => undefined);
    await this.admin?.disconnect().catch(() => undefined);
    await this.pool.end().catch(() => undefined);
  }
}

async function waitForTopics(admin: Admin, topics: readonly string[]): Promise<void> {
  const deadline = Date.now() + 10_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      for (const topic of topics) {
        const offsets = await admin.fetchTopicOffsets(topic);
        if (offsets.length === 0) throw new Error(`topic ${topic} has no partitions yet.`);
      }
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  const message = lastError instanceof Error ? lastError.message : "topics were not ready.";
  throw new Error(message);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#src/nest/stream-context.ts";
