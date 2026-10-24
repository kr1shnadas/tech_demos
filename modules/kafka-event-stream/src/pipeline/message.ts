/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { IHeaders } from "kafkajs";

/** A record the outbox stores and the relay copies onto Kafka. */
export interface StreamRecord {
  eventId: string;
  partitionKey: string;
  sequence: number;
  eventType: string;
  payload: Record<string, unknown>;
}

export const HEADER_ATTEMPT = "x-attempt";
export const HEADER_NOT_BEFORE = "x-not-before";
export const HEADER_EVENT_ID = "x-event-id";

export function isPoison(record: StreamRecord): boolean {
  return record.payload.poison === true || record.eventType === "ingestion.poison";
}

/**
 * A key is held when an earlier record for that key has not finished.
 * The blocked record itself is not held; it is the one being retried.
 */
export function shouldHold(gateEventId: string | null, eventId: string): boolean {
  return gateEventId !== null && gateEventId !== eventId;
}

export function encodeRecord(record: StreamRecord): Buffer {
  return Buffer.from(JSON.stringify(record), "utf8");
}

export function decodeRecord(value: Buffer | string | null): StreamRecord {
  if (value == null) throw new Error("Kafka record has an empty value.");
  const text = typeof value === "string" ? value : value.toString("utf8");
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("Kafka record is not an object.");
  const body = parsed as Partial<StreamRecord>;
  if (!body.eventId || !body.partitionKey || !body.eventType || typeof body.sequence !== "number") {
    throw new Error("Kafka record is missing eventId, partitionKey, sequence or eventType.");
  }
  const payload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : {};
  return {
    eventId: body.eventId,
    partitionKey: body.partitionKey,
    sequence: body.sequence,
    eventType: body.eventType,
    payload,
  };
}

export function headerString(headers: IHeaders | undefined, name: string): string | undefined {
  const raw = headers?.[name];
  if (raw == null) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value == null) return undefined;
  return value.toString();
}

export function readAttempt(headers: IHeaders | undefined): number {
  const raw = headerString(headers, HEADER_ATTEMPT);
  if (!raw) return 1;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return 1;
  return value;
}

export function readNotBefore(headers: IHeaders | undefined): number | undefined {
  const raw = headerString(headers, HEADER_NOT_BEFORE);
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) return undefined;
  return value;
}

export function asPayload(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#src/pipeline/message.ts";
