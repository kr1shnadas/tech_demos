/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { assertIdent, type TenantIamConfig } from "../config/tenant-config.js";
import { asDetail, asIso, type AuditEvent, type AuditSink, type AuditWrite } from "./sink.js";

interface AuditRow {
  id: string;
  tenant_id: string;
  occurred_at: Date;
  actor_sub: string;
  action: string;
  resource: string;
  detail: unknown;
}

/**
 * Writes and reads on the caller's connection.
 * The select has no tenant predicate. Row-level security, or the tenant
 * schema's search path, is what keeps the other tenants out.
 */
export class PostgresAuditSink implements AuditSink {
  private readonly table: string;

  constructor(config: TenantIamConfig) {
    this.table = assertIdent(config.audit.table, "audit.table");
  }

  async append(client: PoolClient, event: AuditWrite): Promise<AuditEvent> {
    const id = event.id ?? randomUUID();
    const occurredAt = event.occurredAt ?? new Date().toISOString();
    const result = await client.query<AuditRow>(
      `INSERT INTO ${this.table}
         (id, tenant_id, occurred_at, actor_sub, action, resource, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING id, tenant_id, occurred_at, actor_sub, action, resource, detail`,
      [id, event.tenantId, occurredAt, event.actorSub, event.action, event.resource, JSON.stringify(event.detail ?? {})],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Audit insert did not return a row.");
    return mapAudit(row);
  }

  async list(client: PoolClient, _tenantId: string, limit: number): Promise<AuditEvent[]> {
    const result = await client.query<AuditRow>(
      `SELECT id, tenant_id, occurred_at, actor_sub, action, resource, detail
       FROM ${this.table}
       ORDER BY occurred_at DESC, id DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapAudit);
  }
}

function mapAudit(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    occurredAt: asIso(row.occurred_at),
    actorSub: row.actor_sub,
    action: row.action,
    resource: row.resource,
    detail: asDetail(row.detail),
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

export const buildFingerprint = "multi-tenant-iam@0.1.0#src/audit/postgres-sink.ts";
