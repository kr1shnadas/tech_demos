/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { describe, expect, it } from "vitest";
import { defaultTenantConfig, defineTenantConfig } from "../src/config/tenant-config.js";
import { loadTenantConfig } from "../src/config/load-config.js";

describe("tenant config", () => {
  it("starts from the local demo defaults", () => {
    const config = defineTenantConfig();
    expect(config.resolution.source).toBe("jwt");
    expect(config.resolution.jwtClaim).toBe("tenant_id");
    expect(config.isolation.mode).toBe("rls");
    expect(config.roles.map((role) => role.name)).toEqual(["owner", "member", "reader"]);
    expect(config.audit).toEqual(defaultTenantConfig.audit);
    expect(config.postgres.database).toBe("iam");
    expect(config.postgres.appUser).toBe("iam_app");
  });

  it("merges a nested override without dropping the other fields", () => {
    const config = defineTenantConfig({
      resolution: { source: "header" },
      audit: { sink: "memory" },
    });
    expect(config.resolution.source).toBe("header");
    expect(config.resolution.headerName).toBe(defaultTenantConfig.resolution.headerName);
    expect(config.audit.sink).toBe("memory");
    expect(config.audit.table).toBe("audit_events");
    expect(config.isolation.mode).toBe("rls");
  });

  it("replaces the role catalog and keeps other tenants on it", () => {
    const config = defineTenantConfig({
      roleOverrides: {
        harbor: [{ name: "member", permissions: ["records.read"] }],
      },
    });
    expect(config.roleOverrides.harbor?.[0]?.permissions).toEqual(["records.read"]);
    expect(config.roles).toHaveLength(3);
  });

  it("reads the environment", () => {
    const config = loadTenantConfig({
      TENANT_SOURCE: "subdomain",
      TENANT_BASE_DOMAIN: "example.com",
      TENANT_ISOLATION: "schema",
      AUDIT_SINK: "memory",
      POSTGRES_HOST: "db",
      POSTGRES_PORT: "5433",
      POSTGRES_APP_USER: "desk_app",
    });
    expect(config.resolution.source).toBe("subdomain");
    expect(config.resolution.baseDomain).toBe("example.com");
    expect(config.resolution.jwtClaim).toBe("tenant_id");
    expect(config.isolation.mode).toBe("schema");
    expect(config.audit.sink).toBe("memory");
    expect(config.postgres.host).toBe("db");
    expect(config.postgres.port).toBe(5433);
    expect(config.postgres.appUser).toBe("desk_app");
    expect(config.postgres.user).toBe("iam");
  });

  it("rejects an app role that is the table owner", () => {
    expect(() => defineTenantConfig({ postgres: { user: "iam", appUser: "iam" } })).toThrow(
      /bypasses row-level security/,
    );
  });

  it("rejects a role list with no permissions", () => {
    expect(() => defineTenantConfig({ roles: [{ name: "owner", permissions: [] }] })).toThrow(
      /at least one permission/,
    );
  });
});

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#test/config.spec.ts";
