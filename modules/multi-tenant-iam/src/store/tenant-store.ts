/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { permissionsFor, roleKnown } from "../access/permissions.js";
import type { AuditEvent, AuditSink } from "../audit/sink.js";
import { asIso } from "../audit/sink.js";
import { assertTenantId, type TenantIamConfig } from "../config/tenant-config.js";
import { schemaNameForTenant, TenantDb } from "../db/tenant-db.js";

export class TenantError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 = 400,
  ) {
    super(message);
    this.name = "TenantError";
  }
}

export interface TenantInfo {
  id: string;
  name: string;
}

export interface Membership {
  tenantId: string;
  userSub: string;
  roleName: string;
  permissions: string[];
}

export interface MemberRow {
  userSub: string;
  roleName: string;
}

export interface TenantRecord {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
}

export interface NewRecord {
  title: string;
  body: string;
  id?: string;
  createdAt?: string;
}

interface RecordRow {
  id: string;
  tenant_id: string;
  title: string;
  body: string;
  created_by: string;
  created_at: Date;
}

@Injectable()
export class TenantStore {
  constructor(
    private readonly db: TenantDb,
    private readonly config: TenantIamConfig,
    private readonly audit: AuditSink,
  ) {}

  async upsertTenant(id: string, name: string): Promise<void> {
    assertTenantId(id);
    const trimmed = name.trim();
    if (!trimmed) throw new TenantError("Tenant name is required.");
    await this.db.admin.query(
      `INSERT INTO tenants (id, name) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [id, trimmed],
    );
    await this.db.ensureTenantSchema(id);
  }

  async upsertMembership(tenantId: string, userSub: string, roleName: string): Promise<void> {
    assertTenantId(tenantId);
    const sub = userSub.trim();
    if (!sub) throw new TenantError("User id is required.");
    if (!roleKnown(this.config, tenantId, roleName)) {
      throw new TenantError(`Unknown role ${roleName}.`);
    }
    const table = membershipTable(this.config, tenantId);
    await this.db.admin.query(
      `INSERT INTO ${table} (tenant_id, user_sub, role_name) VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, user_sub) DO UPDATE SET role_name = EXCLUDED.role_name`,
      [tenantId, sub, roleName],
    );
  }

  async getTenant(id: string): Promise<TenantInfo | null> {
    const result = await this.db.app.query<{ id: string; name: string }>(
      "SELECT id, name FROM tenants WHERE id = $1",
      [id],
    );
    const row = result.rows[0];
    return row ? { id: row.id, name: row.name } : null;
  }

  async findMembership(tenantId: string, userSub: string): Promise<Membership | null> {
    const rows = await this.db.withTenant(tenantId, async (client) => {
      const result = await client.query<{ role_name: string }>(
        "SELECT role_name FROM memberships WHERE user_sub = $1 AND tenant_id = $2",
        [userSub, tenantId],
      );
      return result.rows;
    });
    const row = rows[0];
    if (!row) return null;
    return {
      tenantId,
      userSub,
      roleName: row.role_name,
      permissions: permissionsFor(this.config, tenantId, row.role_name),
    };
  }

  async listMembers(tenantId: string): Promise<MemberRow[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const result = await client.query<{ user_sub: string; role_name: string }>(
        "SELECT user_sub, role_name FROM memberships ORDER BY user_sub ASC",
      );
      return result.rows.map((row) => ({ userSub: row.user_sub, roleName: row.role_name }));
    });
  }

  /**
   * Selects every row the session can see. There is no tenant predicate here.
   */
  async listRecords(tenantId: string): Promise<TenantRecord[]> {
    return this.db.withTenant(tenantId, async (client) => {
      const result = await client.query<RecordRow>(
        `SELECT id, tenant_id, title, body, created_by, created_at
         FROM records
         ORDER BY created_at DESC, id DESC
         LIMIT 100`,
      );
      return result.rows.map(mapRecord);
    });
  }

  async createRecord(tenantId: string, input: NewRecord, actorSub: string): Promise<TenantRecord> {
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title || title.length > 120) throw new TenantError("Title must be 1 to 120 characters.");
    if (!body || body.length > 2000) throw new TenantError("Body must be 1 to 2000 characters.");
    const id = input.id ?? randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new TenantError("Record id must be a uuid.");
    }
    const actor = actorSub.trim();
    if (!actor) throw new TenantError("Actor is required.");

    return this.db.withTenant(tenantId, async (client) => {
      const inserted = await client.query<RecordRow>(
        `INSERT INTO records (id, tenant_id, title, body, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()))
         ON CONFLICT (id) DO NOTHING
         RETURNING id, tenant_id, title, body, created_by, created_at`,
        [id, tenantId, title, body, actor, input.createdAt ?? null],
      );
      const created = inserted.rows[0];
      if (!created) {
        const existing = await client.query<RecordRow>(
          `SELECT id, tenant_id, title, body, created_by, created_at FROM records WHERE id = $1`,
          [id],
        );
        const row = existing.rows[0];
        if (!row) throw new TenantError("Record was not stored.", 404);
        return mapRecord(row);
      }
      await this.audit.append(client, {
        tenantId,
        actorSub: actor,
        action: "record.create",
        resource: created.id,
        detail: { title: created.title },
        occurredAt: asIso(created.created_at),
      });
      return mapRecord(created);
    });
  }

  async listAudit(tenantId: string, limit = 50): Promise<AuditEvent[]> {
    const capped = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50;
    return this.db.withTenant(tenantId, (client) => this.audit.list(client, tenantId, capped));
  }

  async ping(): Promise<void> {
    await this.db.ping();
  }
}

function membershipTable(config: TenantIamConfig, tenantId: string): string {
  if (config.isolation.mode === "schema") return `${schemaNameForTenant(tenantId)}.memberships`;
  return "memberships";
}

function mapRecord(row: RecordRow): TenantRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    body: row.body,
    createdBy: row.created_by,
    createdAt: asIso(row.created_at),
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

export const buildFingerprint = "multi-tenant-iam@0.1.0#src/store/tenant-store.ts";
