/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresAuditSink } from "../src/audit/postgres-sink.js";
import { defineTenantConfig, type IsolationMode } from "../src/config/tenant-config.js";
import { TenantDb } from "../src/db/tenant-db.js";
import { TenantStore } from "../src/store/tenant-store.js";
import { createDatabase, dropDatabase, startPostgres, type PostgresHandle } from "./support/postgres.js";

interface Fixture {
  db: TenantDb;
  store: TenantStore;
}

describe("no cross-tenant leakage", () => {
  let postgres: PostgresHandle;
  let rls: Fixture;
  let schema: Fixture;

  beforeAll(async () => {
    postgres = await startPostgres();
    await createDatabase(postgres, "iam_rls");
    await createDatabase(postgres, "iam_schema");
    rls = await boot(postgres, "iam_rls", "rls");
    schema = await boot(postgres, "iam_schema", "schema");
  });

  afterAll(async () => {
    await rls?.db.close();
    await schema?.db.close();
    if (!postgres) return;
    await dropDatabase(postgres, "iam_rls");
    await dropDatabase(postgres, "iam_schema");
    await postgres.stop();
  });

  it("gives the app role no way around row security", async () => {
    const role = await rls.db.admin.query<{ rolsuper: boolean; rolbypassrls: boolean; rolinherit: boolean }>(
      "SELECT rolsuper, rolbypassrls, rolinherit FROM pg_roles WHERE rolname = 'iam_app'",
    );
    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false, rolinherit: false });
  });

  it("returns only the session tenant from an unfiltered select", async () => {
    const rows = await rls.db.withTenant("alpha", (client) =>
      client.query<{ tenant_id: string; title: string }>("SELECT tenant_id, title FROM records"),
    );
    expect(rows.rows.map((row) => row.title).sort()).toEqual(["Alpha note"]);
    expect(rows.rows.every((row) => row.tenant_id === "alpha")).toBe(true);

    const throughStore = await rls.store.listRecords("bravo");
    expect(throughStore.map((row) => row.title)).toEqual(["Bravo note"]);
    expect(throughStore.some((row) => row.tenantId === "alpha")).toBe(false);
  });

  it("hides the other tenant's members and audit rows the same way", async () => {
    const members = await rls.db.withTenant("alpha", (client) =>
      client.query<{ tenant_id: string; user_sub: string }>("SELECT tenant_id, user_sub FROM memberships"),
    );
    expect(members.rows.map((row) => row.user_sub).sort()).toEqual(["ada"]);
    expect(members.rows.every((row) => row.tenant_id === "alpha")).toBe(true);

    const audit = await rls.db.withTenant("alpha", (client) =>
      client.query<{ tenant_id: string }>("SELECT tenant_id, detail FROM audit_events"),
    );
    expect(audit.rows.length).toBeGreaterThan(0);
    expect(audit.rows.every((row) => row.tenant_id === "alpha")).toBe(true);

    const trail = await rls.store.listAudit("bravo");
    expect(trail.every((event) => event.tenantId === "bravo")).toBe(true);
    expect(trail.some((event) => event.detail.title === "Alpha note")).toBe(false);
  });

  it("rejects an insert or tenant change that names the other tenant", async () => {
    await expect(
      rls.db.withTenant("alpha", (client) =>
        client.query(
          `INSERT INTO records (id, tenant_id, title, body, created_by)
           VALUES ($1, 'bravo', 'Stolen', 'no', 'ada')`,
          [randomUUID()],
        ),
      ),
    ).rejects.toThrow(/row-level security/);

    const mine = await rls.db.withTenant("alpha", (client) =>
      client.query<{ id: string }>("SELECT id FROM records"),
    );
    await expect(
      rls.db.withTenant("alpha", (client) =>
        client.query("UPDATE records SET tenant_id = 'bravo' WHERE id = $1", [mine.rows[0]?.id]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("does not update or delete a row that belongs to the other tenant", async () => {
    const bravo = await rls.db.withTenant("bravo", (client) =>
      client.query<{ id: string; title: string }>("SELECT id, title FROM records"),
    );
    const id = bravo.rows[0]?.id;
    const title = bravo.rows[0]?.title;
    const updated = await rls.db.withTenant("alpha", (client) =>
      client.query("UPDATE records SET title = 'stolen' WHERE id = $1", [id]),
    );
    const deleted = await rls.db.withTenant("alpha", (client) =>
      client.query("DELETE FROM records WHERE id = $1", [id]),
    );
    expect(updated.rowCount).toBe(0);
    expect(deleted.rowCount).toBe(0);
    const still = await rls.db.admin.query<{ title: string }>("SELECT title FROM records WHERE id = $1", [id]);
    expect(still.rows[0]?.title).toBe(title);
  });

  it("returns nothing when the session tenant is unset", async () => {
    const client = await rls.db.app.connect();
    try {
      const rows = await client.query("SELECT id FROM records");
      expect(rows.rows).toEqual([]);
      const setting = await client.query<{ tenant: string | null }>(
        "SELECT current_setting('app.tenant_id', true) AS tenant",
      );
      expect(blankSetting(setting.rows[0]?.tenant)).toBe(true);
    } finally {
      client.release();
    }
  });

  it("does not keep the tenant setting after the connection returns to the pool", async () => {
    await rls.db.withTenant("alpha", async (client) => {
      const seen = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM records");
      expect(seen.rows[0]?.n).toBeGreaterThan(0);
    });
    const client = await rls.db.app.connect();
    try {
      await client.query("BEGIN");
      const setting = await client.query<{ tenant: string | null }>(
        "SELECT current_setting('app.tenant_id', true) AS tenant",
      );
      const rows = await client.query("SELECT id FROM records");
      await client.query("ROLLBACK");
      expect(rows.rows).toEqual([]);
      expect(blankSetting(setting.rows[0]?.tenant)).toBe(true);
    } finally {
      client.release();
    }
  });

  it("shows that the owner connection is not the runtime connection", async () => {
    const all = await rls.db.admin.query<{ tenant_id: string }>("SELECT tenant_id FROM records");
    expect(new Set(all.rows.map((row) => row.tenant_id))).toEqual(new Set(["alpha", "bravo"]));
  });

  it("keeps a schema-scoped role out of the other tenant's tables", async () => {
    const own = await schema.db.withTenant("alpha", (client) =>
      client.query<{ title: string }>("SELECT title FROM records"),
    );
    expect(own.rows.map((row) => row.title)).toEqual(["Alpha note"]);

    const audit = await schema.store.listAudit("bravo");
    expect(audit.every((event) => event.detail.title !== "Alpha note")).toBe(true);

    await expectDenied(schema.db.withTenant("alpha", (client) => client.query("SELECT title FROM tenant_bravo.records")));

    const bare = await schema.db.app.connect();
    try {
      await expectDenied(bare.query("SELECT title FROM tenant_alpha.records"));
      await expectDenied(bare.query("SELECT title FROM tenant_bravo.records"));
    } finally {
      bare.release();
    }
  });
});

async function boot(postgres: PostgresHandle, database: string, mode: IsolationMode): Promise<Fixture> {
  const config = defineTenantConfig({
    isolation: { mode },
    postgres: {
      host: postgres.host,
      port: postgres.port,
      user: postgres.user,
      password: postgres.password,
      database,
      appUser: "iam_app",
      appPassword: "iam_app",
    },
  });
  const db = new TenantDb(config);
  await db.provision();
  const store = new TenantStore(db, config, new PostgresAuditSink(config));
  await store.upsertTenant("alpha", "Alpha Lab");
  await store.upsertTenant("bravo", "Bravo Clinic");
  await store.upsertMembership("alpha", "ada", "owner");
  await store.upsertMembership("bravo", "ada", "reader");
  await store.upsertMembership("bravo", "ben", "member");
  await store.createRecord("alpha", { title: "Alpha note", body: "Only alpha should see this." }, "ada");
  await store.createRecord("bravo", { title: "Bravo note", body: "Only bravo should see this." }, "ben");
  return { db, store };
}

function blankSetting(value: string | null | undefined): boolean {
  return value === null || value === undefined || value === "";
}

async function expectDenied(query: Promise<unknown>): Promise<void> {
  try {
    await query;
  } catch (error) {
    expect((error as { code?: string }).code).toBe("42501");
    return;
  }
  throw new Error("The other tenant's table was readable.");
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#test/isolation.spec.ts";
