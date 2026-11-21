/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { existsSync, readFileSync } from "node:fs";
import {
  defineTenantConfig,
  type AuditSinkName,
  type IsolationMode,
  type TenantConfigOverrides,
  type TenantIamConfig,
  type TenantRole,
  type TenantSource,
} from "./tenant-config.js";

const sources = new Set<TenantSource>(["jwt", "header", "subdomain"]);
const modes = new Set<IsolationMode>(["rls", "schema"]);
const sinks = new Set<AuditSinkName>(["postgres", "memory"]);

/**
 * Builds the config from the environment.
 * Unset variables keep the defaults in `defineTenantConfig`.
 * When this reads `process.env` and a `.env` file is present, values already
 * set in the environment win.
 */
export function loadTenantConfig(env: NodeJS.ProcessEnv = process.env): TenantIamConfig {
  if (env === process.env) loadEnvFile();
  const overrides: TenantConfigOverrides = {};

  const resolution: NonNullable<TenantConfigOverrides["resolution"]> = {};
  if (present(env.TENANT_SOURCE)) resolution.source = readSource(env.TENANT_SOURCE);
  if (present(env.TENANT_JWT_CLAIM)) resolution.jwtClaim = env.TENANT_JWT_CLAIM.trim();
  if (present(env.TENANT_HEADER)) resolution.headerName = env.TENANT_HEADER.trim().toLowerCase();
  if (present(env.TENANT_BASE_DOMAIN)) resolution.baseDomain = env.TENANT_BASE_DOMAIN.trim().toLowerCase();
  if (Object.keys(resolution).length > 0) overrides.resolution = resolution;

  if (present(env.TENANT_ISOLATION)) {
    overrides.isolation = { mode: readMode(env.TENANT_ISOLATION) };
  }
  if (present(env.TENANT_ROLES)) overrides.roles = readRoles(env.TENANT_ROLES);
  if (present(env.TENANT_ROLE_OVERRIDES)) overrides.roleOverrides = readOverrides(env.TENANT_ROLE_OVERRIDES);

  const audit: NonNullable<TenantConfigOverrides["audit"]> = {};
  if (present(env.AUDIT_SINK)) audit.sink = readSink(env.AUDIT_SINK);
  if (present(env.AUDIT_TABLE)) audit.table = env.AUDIT_TABLE.trim();
  if (Object.keys(audit).length > 0) overrides.audit = audit;

  const postgres: NonNullable<TenantConfigOverrides["postgres"]> = {};
  if (present(env.POSTGRES_HOST)) postgres.host = env.POSTGRES_HOST.trim();
  if (present(env.POSTGRES_PORT)) postgres.port = readInt("POSTGRES_PORT", env.POSTGRES_PORT);
  if (present(env.POSTGRES_USER)) postgres.user = env.POSTGRES_USER.trim();
  if (present(env.POSTGRES_PASSWORD)) postgres.password = env.POSTGRES_PASSWORD;
  if (present(env.POSTGRES_DATABASE)) postgres.database = env.POSTGRES_DATABASE.trim();
  if (present(env.POSTGRES_APP_USER)) postgres.appUser = env.POSTGRES_APP_USER.trim();
  if (present(env.POSTGRES_APP_PASSWORD)) postgres.appPassword = env.POSTGRES_APP_PASSWORD;
  if (Object.keys(postgres).length > 0) overrides.postgres = postgres;

  return defineTenantConfig(overrides);
}

export function loadEnvFile(path = ".env"): void {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function present(value: string | undefined): value is string {
  return Boolean(value && value.trim());
}

function readInt(name: string, raw: string): number {
  const value = Number(raw.trim());
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer.`);
  return value;
}

function readSource(raw: string): TenantSource {
  const value = raw.trim() as TenantSource;
  if (!sources.has(value)) throw new Error("TENANT_SOURCE must be jwt, header or subdomain.");
  return value;
}

function readMode(raw: string): IsolationMode {
  const value = raw.trim() as IsolationMode;
  if (!modes.has(value)) throw new Error("TENANT_ISOLATION must be rls or schema.");
  return value;
}

function readSink(raw: string): AuditSinkName {
  const value = raw.trim() as AuditSinkName;
  if (!sinks.has(value)) throw new Error("AUDIT_SINK must be postgres or memory.");
  return value;
}

function readRoles(raw: string): TenantRole[] {
  const parsed = parseJson("TENANT_ROLES", raw);
  if (!Array.isArray(parsed)) throw new Error("TENANT_ROLES must be a JSON array.");
  return parsed as TenantRole[];
}

function readOverrides(raw: string): Record<string, TenantRole[]> {
  const parsed = parseJson("TENANT_ROLE_OVERRIDES", raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("TENANT_ROLE_OVERRIDES must be a JSON object.");
  }
  return parsed as Record<string, TenantRole[]>;
}

function parseJson(name: string, raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`${name} must be JSON.`);
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

export const buildFingerprint = "multi-tenant-iam@0.1.0#src/config/load-config.ts";
