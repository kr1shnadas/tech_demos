/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Pool, type PoolClient, type PoolConfig } from "pg";
import { assertIdent, assertTenantId, type TenantIamConfig } from "../config/tenant-config.js";

/** Session setting read by the row-level security policies. */
export const tenantSetting = "app.tenant_id";

export function schemaNameForTenant(tenantId: string): string {
  return `tenant_${assertTenantId(tenantId)}`;
}

/**
 * Owns the migration connection and the runtime connection.
 * Queries from the desk go through `withTenant` on the runtime role.
 */
@Injectable()
export class TenantDb implements OnModuleDestroy {
  readonly admin: Pool;
  readonly app: Pool;

  constructor(private readonly config: TenantIamConfig) {
    this.admin = new Pool(poolOptions(config, "admin"));
    this.app = new Pool(poolOptions(config, "app"));
  }

  async provision(): Promise<void> {
    await ensureAppRole(this.admin, this.config);
    if (this.config.isolation.mode === "rls") {
      await provisionRls(this.admin, this.config);
    } else {
      await provisionSchemaCatalog(this.admin, this.config);
      const existing = await this.admin.query<{ id: string }>("SELECT id FROM tenants");
      for (const row of existing.rows) {
        await ensureTenantSchema(this.admin, this.config, row.id);
      }
    }
  }

  async ensureTenantSchema(tenantId: string): Promise<void> {
    if (this.config.isolation.mode !== "schema") return;
    await ensureTenantSchema(this.admin, this.config, tenantId);
  }

  /**
   * Runs `fn` inside a transaction scoped to one tenant.
   * The setting is local to the transaction, so the pooled connection
   * does not keep it for the next checkout.
   */
  async withTenant<T>(tenantId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    assertTenantId(tenantId);
    const client = await this.app.connect();
    let destroy = false;
    try {
      await client.query("BEGIN");
      await applyScope(client, this.config, tenantId);
      const value = await fn(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      destroy = true;
      try {
        await client.query("ROLLBACK");
      } catch {
        // The transaction is already aborted.
      }
      throw error;
    } finally {
      try {
        if (!destroy) await client.query("RESET ROLE");
      } catch {
        destroy = true;
      }
      if (destroy) client.release(true);
      else client.release();
    }
  }

  async ping(): Promise<void> {
    await this.app.query("SELECT 1");
  }

  async close(): Promise<void> {
    await this.app.end().catch(() => undefined);
    await this.admin.end().catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}

async function applyScope(client: PoolClient, config: TenantIamConfig, tenantId: string): Promise<void> {
  if (config.isolation.mode === "rls") {
    await client.query("SELECT set_config($1, $2, true)", [tenantSetting, tenantId]);
    return;
  }
  const schema = schemaNameForTenant(tenantId);
  // NOINHERIT on the app role means this grant is dormant until SET ROLE.
  await client.query(`SET LOCAL ROLE ${schema}`);
  await client.query("SELECT set_config('search_path', $1, true)", [`${schema}, public`]);
}

function poolOptions(config: TenantIamConfig, kind: "admin" | "app"): PoolConfig {
  const postgres = config.postgres;
  return {
    host: postgres.host,
    port: postgres.port,
    database: postgres.database,
    user: kind === "admin" ? postgres.user : postgres.appUser,
    password: kind === "admin" ? postgres.password : postgres.appPassword,
    max: 8,
    application_name: kind === "admin" ? "multi-tenant-iam-migrate" : "multi-tenant-iam",
  };
}

async function ensureAppRole(admin: Pool, config: TenantIamConfig): Promise<void> {
  const user = assertIdent(config.postgres.appUser, "postgres.appUser");
  const database = assertIdent(config.postgres.database, "postgres.database");
  const found = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [user]);
  if ((found.rowCount ?? 0) === 0) {
    await admin.query(
      `CREATE ROLE ${user} LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE`,
    );
  } else {
    await admin.query(`ALTER ROLE ${user} LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE`);
  }
  await admin.query(`ALTER ROLE ${user} PASSWORD ${quoteLiteral(config.postgres.appPassword)}`);
  await admin.query(`GRANT CONNECT ON DATABASE ${database} TO ${user}`);
  await admin.query(`GRANT USAGE ON SCHEMA public TO ${user}`);
}

async function provisionRls(admin: Pool, config: TenantIamConfig): Promise<void> {
  const appUser = assertIdent(config.postgres.appUser, "postgres.appUser");
  const audit = assertIdent(config.audit.table, "audit.table");
  await admin.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id text PRIMARY KEY,
      name text NOT NULL,
      CONSTRAINT tenants_id_shape CHECK (id ~ '^[a-z][a-z0-9_]{0,40}$')
    )
  `);
  await admin.query(`
    CREATE TABLE IF NOT EXISTS memberships (
      tenant_id text NOT NULL REFERENCES tenants (id),
      user_sub text NOT NULL,
      role_name text NOT NULL,
      PRIMARY KEY (tenant_id, user_sub)
    )
  `);
  await admin.query(`
    CREATE TABLE IF NOT EXISTS records (
      id uuid PRIMARY KEY,
      tenant_id text NOT NULL REFERENCES tenants (id),
      title text NOT NULL,
      body text NOT NULL,
      created_by text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await admin.query(`
    CREATE TABLE IF NOT EXISTS ${audit} (
      id uuid PRIMARY KEY,
      tenant_id text NOT NULL REFERENCES tenants (id),
      occurred_at timestamptz NOT NULL DEFAULT now(),
      actor_sub text NOT NULL,
      action text NOT NULL,
      resource text NOT NULL,
      detail jsonb NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  for (const table of ["memberships", "records", audit]) {
    await admin.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    await admin.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    await admin.query(`DROP POLICY IF EXISTS ${table}_tenant ON ${table}`);
    await admin.query(`
      CREATE POLICY ${table}_tenant ON ${table}
        USING (tenant_id = current_setting('${tenantSetting}', true))
        WITH CHECK (tenant_id = current_setting('${tenantSetting}', true))
    `);
    await admin.query(`REVOKE ALL ON ${table} FROM PUBLIC`);
    await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO ${appUser}`);
  }
  await admin.query(`REVOKE ALL ON tenants FROM PUBLIC`);
  await admin.query(`GRANT SELECT ON tenants TO ${appUser}`);
}

async function provisionSchemaCatalog(admin: Pool, config: TenantIamConfig): Promise<void> {
  const appUser = assertIdent(config.postgres.appUser, "postgres.appUser");
  await admin.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id text PRIMARY KEY,
      name text NOT NULL,
      CONSTRAINT tenants_id_shape CHECK (id ~ '^[a-z][a-z0-9_]{0,40}$')
    )
  `);
  await admin.query(`REVOKE ALL ON tenants FROM PUBLIC`);
  await admin.query(`GRANT SELECT ON tenants TO ${appUser}`);
}

async function ensureTenantSchema(admin: Pool, config: TenantIamConfig, tenantId: string): Promise<void> {
  const schema = schemaNameForTenant(tenantId);
  const appUser = assertIdent(config.postgres.appUser, "postgres.appUser");
  const audit = assertIdent(config.audit.table, "audit.table");
  await admin.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  await admin.query(`REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC`);
  const found = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [schema]);
  if ((found.rowCount ?? 0) === 0) {
    await admin.query(`CREATE ROLE ${schema} NOLOGIN`);
  }
  await admin.query(`
    CREATE TABLE IF NOT EXISTS ${schema}.memberships (
      tenant_id text NOT NULL REFERENCES public.tenants (id),
      user_sub text NOT NULL,
      role_name text NOT NULL,
      PRIMARY KEY (tenant_id, user_sub)
    )
  `);
  await admin.query(`
    CREATE TABLE IF NOT EXISTS ${schema}.records (
      id uuid PRIMARY KEY,
      tenant_id text NOT NULL REFERENCES public.tenants (id),
      title text NOT NULL,
      body text NOT NULL,
      created_by text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await admin.query(`
    CREATE TABLE IF NOT EXISTS ${schema}.${audit} (
      id uuid PRIMARY KEY,
      tenant_id text NOT NULL REFERENCES public.tenants (id),
      occurred_at timestamptz NOT NULL DEFAULT now(),
      actor_sub text NOT NULL,
      action text NOT NULL,
      resource text NOT NULL,
      detail jsonb NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  await admin.query(`REVOKE ALL ON ALL TABLES IN SCHEMA ${schema} FROM PUBLIC`);
  await admin.query(`GRANT USAGE ON SCHEMA ${schema} TO ${schema}`);
  await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${schema}`);
  await admin.query(`GRANT ${schema} TO ${appUser}`);
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#src/db/tenant-db.ts";
