/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { randomUUID } from "node:crypto";
import { BadRequestException, Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { ConsumerService, ProducerService, type ReplayResult, type StreamRecord, type StreamStatus } from "../../src/index.js";

interface EventBody {
  kind?: unknown;
  partitionKey?: unknown;
}

interface ReplayBody {
  partition?: unknown;
  offset?: unknown;
  limit?: unknown;
}

@Controller("api")
export class EventsController {
  constructor(
    @Inject(ProducerService) private readonly producer: ProducerService,
    @Inject(ConsumerService) private readonly consumer: ConsumerService,
  ) {}

  @Get("health")
  async health(): Promise<{ status: string; service: string }> {
    await this.producer.ping();
    return { status: "ok", service: "kafka-event-stream" };
  }

  @Get("status")
  status(): Promise<StreamStatus> {
    return this.consumer.status();
  }

  @Post("events")
  async create(@Body() body: EventBody): Promise<StreamRecord> {
    const kind = readKind(body?.kind);
    const partitionKey = readKey(body?.partitionKey, kind === "poison" ? "batch-poison" : "batch-14");
    return this.producer.enqueue({
      partitionKey,
      eventType: kind === "poison" ? "ingestion.poison" : "ingestion.accepted",
      payload: {
        batchId: partitionKey,
        recordId: randomUUID(),
        source: "status-page",
        poison: kind === "poison",
      },
    });
  }

  @Post("replay")
  replay(@Body() body: ReplayBody): Promise<ReplayResult> {
    const offset = body?.offset === undefined || body.offset === null || body.offset === "" ? "0" : String(body.offset).trim();
    if (!/^\d+$/.test(offset)) throw new BadRequestException("offset must be a non-negative integer.");
    let partition: number | undefined;
    if (body?.partition !== undefined && body.partition !== null && body.partition !== "") {
      partition = Number(body.partition);
      if (!Number.isInteger(partition) || partition < 0) {
        throw new BadRequestException("partition must be a non-negative integer.");
      }
    }
    const limit = body?.limit === undefined || body.limit === null || body.limit === "" ? 50 : Number(body.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new BadRequestException("limit must be an integer from 1 to 500.");
    }
    return this.consumer.replay({ offset, partition, limit });
  }
}

function readKind(value: unknown): "good" | "poison" {
  if (value === "good" || value === "poison") return value;
  throw new BadRequestException("kind must be good or poison.");
}

function readKey(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#demo/api/events.controller.ts";
