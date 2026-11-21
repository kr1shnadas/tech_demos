/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { asDetail, asIso, type AuditEvent, type AuditSink, type AuditWrite } from "./sink.js";

/** Process-local trail. Each tenant has its own list. */
export class MemoryAuditSink implements AuditSink {
  private readonly events: AuditEvent[] = [];

  async append(_client: PoolClient, event: AuditWrite): Promise<AuditEvent> {
    const row: AuditEvent = {
      id: event.id ?? randomUUID(),
      tenantId: event.tenantId,
      occurredAt: event.occurredAt ? asIso(event.occurredAt) : new Date().toISOString(),
      actorSub: event.actorSub,
      action: event.action,
      resource: event.resource,
      detail: asDetail(event.detail ?? {}),
    };
    this.events.push(row);
    return row;
  }

  async list(_client: PoolClient, tenantId: string, limit: number): Promise<AuditEvent[]> {
    return this.events
      .filter((event) => event.tenantId === tenantId)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : b.id.localeCompare(a.id)))
      .slice(0, limit)
      .map((event) => ({ ...event, detail: { ...event.detail } }));
  }
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#src/audit/memory-sink.ts";
