/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export const tenantSources = ["jwt", "header", "subdomain"] as const;
export type TenantSource = (typeof tenantSources)[number];

export const isolationModes = ["rls", "schema"] as const;
export type IsolationMode = (typeof isolationModes)[number];

export const auditSinks = ["postgres", "memory"] as const;
export type AuditSinkName = (typeof auditSinks)[number];

export interface TenantResolution {
  /** Where the tenant id is read from. The token is still checked either way. */
  source: TenantSource;
  /** Dot path into the access token. Used when `source` is `jwt`. */
  jwtClaim: string;
  /** Request header. Used when `source` is `header`. */
  headerName: string;
  /**
   * Host label before this domain is the tenant.
   * `northwind.localhost` with base `localhost` resolves to `northwind`.
   */
  baseDomain: string;
}

export interface IsolationSettings {
  /**
   * `rls` keeps one schema and asks Postgres to hide other tenants' rows.
   * `schema` gives each tenant a schema and a role that can only read that schema.
   */
  mode: IsolationMode;
}

export interface TenantRole {
  name: string;
  permissions: readonly string[];
}

export interface AuditSettings {
  /** `postgres` writes the trail in the tenant scope. `memory` keeps it in the process. */
  sink: AuditSinkName;
  /** Table name when the sink is `postgres`. */
  table: string;
}

export interface PostgresSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  /**
   * Runtime role. It must not be a superuser and must not bypass row security.
   * `user` owns the tables and is used to migrate. The two have to differ.
   */
  appUser: string;
  appPassword: string;
}

/**
 * One object drives tenant resolution, isolation, the role list and the audit sink.
 * Defaults target the Docker Compose demo.
 */
export interface TenantIamConfig {
  resolution: TenantResolution;
  isolation: IsolationSettings;
  /** Catalog used for every tenant that has no entry in `roleOverrides`. */
  roles: readonly TenantRole[];
  /** Replaces the catalog for that tenant. Other tenants keep `roles`. */
  roleOverrides: Readonly<Record<string, readonly TenantRole[]>>;
  audit: AuditSettings;
  postgres: PostgresSettings;
}

export interface TenantConfigOverrides {
  resolution?: Partial<TenantResolution>;
  isolation?: Partial<IsolationSettings>;
  roles?: readonly TenantRole[];
  roleOverrides?: Readonly<Record<string, readonly TenantRole[]>>;
  audit?: Partial<AuditSettings>;
  postgres?: Partial<PostgresSettings>;
}

const ownerPermissions = Object.freeze([
  "records.read",
  "records.write",
  "audit.read",
  "members.read",
]);

const memberPermissions = Object.freeze([
  "records.read",
  "records.write",
  "audit.read",
  "members.read",
]);

const readerPermissions = Object.freeze(["records.read", "audit.read"]);

export const defaultTenantConfig: TenantIamConfig = Object.freeze({
  resolution: Object.freeze({
    source: "jwt" as const,
    jwtClaim: "tenant_id",
    headerName: "x-tenant-id",
    baseDomain: "localhost",
  }),
  isolation: Object.freeze({
    mode: "rls" as const,
  }),
  roles: Object.freeze([
    Object.freeze({ name: "owner", permissions: ownerPermissions }),
    Object.freeze({ name: "member", permissions: memberPermissions }),
    Object.freeze({ name: "reader", permissions: readerPermissions }),
  ]),
  roleOverrides: Object.freeze({}),
  audit: Object.freeze({
    sink: "postgres" as const,
    table: "audit_events",
  }),
  postgres: Object.freeze({
    host: "localhost",
    port: 5432,
    user: "iam",
    password: "iam",
    database: "iam",
    appUser: "iam_app",
    appPassword: "iam_app",
  }),
});

export function defineTenantConfig(overrides: TenantConfigOverrides = {}): TenantIamConfig {
  const merged: TenantIamConfig = {
    resolution: { ...defaultTenantConfig.resolution, ...defined(overrides.resolution ?? {}) },
    isolation: { ...defaultTenantConfig.isolation, ...defined(overrides.isolation ?? {}) },
    roles: overrides.roles ? cloneRoles(overrides.roles) : cloneRoles(defaultTenantConfig.roles),
    roleOverrides: overrides.roleOverrides ? cloneOverrides(overrides.roleOverrides) : {},
    audit: { ...defaultTenantConfig.audit, ...defined(overrides.audit ?? {}) },
    postgres: { ...defaultTenantConfig.postgres, ...defined(overrides.postgres ?? {}) },
  };
  assertTenantConfig(merged);
  return merged;
}

/** Settings the desk can show. Passwords stay on the server. */
export function toPublicTenantConfig(config: TenantIamConfig): Omit<TenantIamConfig, "postgres"> {
  return {
    resolution: { ...config.resolution },
    isolation: { ...config.isolation },
    roles: cloneRoles(config.roles),
    roleOverrides: cloneOverrides(config.roleOverrides),
    audit: { ...config.audit },
  };
}

export function assertTenantConfig(config: TenantIamConfig): void {
  if (!tenantSources.includes(config.resolution.source)) {
    throw new Error("resolution.source must be jwt, header or subdomain.");
  }
  if (!/^[A-Za-z][A-Za-z0-9_.]*$/.test(config.resolution.jwtClaim)) {
    throw new Error("resolution.jwtClaim must be a claim path.");
  }
  if (!/^[a-z][a-z0-9-]*$/.test(config.resolution.headerName)) {
    throw new Error("resolution.headerName must be a lowercase header name.");
  }
  if (!/^[a-z0-9.-]+$/.test(config.resolution.baseDomain)) {
    throw new Error("resolution.baseDomain must be a hostname.");
  }
  if (!isolationModes.includes(config.isolation.mode)) {
    throw new Error("isolation.mode must be rls or schema.");
  }
  assertRoleList(config.roles, "roles");
  for (const [tenantId, roles] of Object.entries(config.roleOverrides)) {
    assertTenantId(tenantId);
    assertRoleList(roles, `roleOverrides.${tenantId}`);
  }
  if (!auditSinks.includes(config.audit.sink)) {
    throw new Error("audit.sink must be postgres or memory.");
  }
  assertIdent(config.audit.table, "audit.table");
  if (!config.postgres.host.trim()) throw new Error("postgres.host is required.");
  if (!Number.isInteger(config.postgres.port) || config.postgres.port < 1 || config.postgres.port > 65535) {
    throw new Error("postgres.port must be an integer from 1 to 65535.");
  }
  assertIdent(config.postgres.user, "postgres.user");
  assertIdent(config.postgres.appUser, "postgres.appUser");
  assertIdent(config.postgres.database, "postgres.database");
  if (config.postgres.user === config.postgres.appUser) {
    throw new Error("postgres.appUser must differ from postgres.user. The owner bypasses row-level security.");
  }
}

export function assertTenantId(value: string): string {
  if (!/^[a-z][a-z0-9_]{0,40}$/.test(value)) {
    throw new Error("Tenant id must be a lowercase identifier.");
  }
  return value;
}

export function assertIdent(value: string, label: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error(`${label} must be a lowercase SQL identifier.`);
  }
  return value;
}

function assertRoleList(roles: readonly TenantRole[], label: string): void {
  if (roles.length === 0) throw new Error(`${label} must list at least one role.`);
  const names = new Set<string>();
  for (const role of roles) {
    if (!/^[a-z][a-z0-9_]{0,40}$/.test(role.name)) {
      throw new Error(`${label} has a role name that is not a lowercase identifier.`);
    }
    if (names.has(role.name)) throw new Error(`${label} lists ${role.name} twice.`);
    names.add(role.name);
    if (role.permissions.length === 0) {
      throw new Error(`${label} role ${role.name} needs at least one permission.`);
    }
    for (const permission of role.permissions) {
      if (!/^[a-z][a-z0-9_.]{0,60}$/.test(permission)) {
        throw new Error(`${label} role ${role.name} has a permission that is not a dotted name.`);
      }
    }
  }
}

function cloneRoles(roles: readonly TenantRole[]): TenantRole[] {
  return roles.map((role) => ({
    name: role.name,
    permissions: [...new Set(role.permissions)],
  }));
}

function cloneOverrides(
  overrides: Readonly<Record<string, readonly TenantRole[]>>,
): Record<string, TenantRole[]> {
  const copy: Record<string, TenantRole[]> = {};
  for (const [tenantId, roles] of Object.entries(overrides)) {
    copy[tenantId] = cloneRoles(roles);
  }
  return copy;
}

function defined<T extends object>(overrides: T): Partial<T> {
  return Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)) as Partial<T>;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#src/config/tenant-config.ts";
