/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { PoolClient } from "pg";

export interface AuditWrite {
  tenantId: string;
  actorSub: string;
  action: string;
  resource: string;
  detail?: Record<string, unknown>;
  id?: string;
  occurredAt?: string;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  occurredAt: string;
  actorSub: string;
  action: string;
  resource: string;
  detail: Record<string, unknown>;
}

/**
 * `client` is the open tenant transaction. The Postgres sink writes on it
 * so the trail commits with the change that caused it. A memory sink ignores
 * the client and partitions by tenant id.
 */
export interface AuditSink {
  append(client: PoolClient, event: AuditWrite): Promise<AuditEvent>;
  list(client: PoolClient, tenantId: string, limit: number): Promise<AuditEvent[]>;
}

export function asDetail(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function asIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#src/audit/sink.ts";
