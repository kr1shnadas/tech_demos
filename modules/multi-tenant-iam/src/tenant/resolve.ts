/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { readClaim } from "@krishnadas/auth-rbac";
import { decodeJwt } from "jose";
import { assertTenantId, type TenantIamConfig } from "../config/tenant-config.js";

export class TenantResolutionError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401,
  ) {
    super(message);
    this.name = "TenantResolutionError";
  }
}

export interface ResolveInput {
  /** Access token, already accepted by the auth guard when the source is the token. */
  token?: string;
  header?: string | string[];
  host?: string | string[];
}

/**
 * Reads the tenant id from the configured source.
 * A missing or malformed id throws. It does not fall through to another source.
 */
export function resolveTenantId(config: TenantIamConfig, input: ResolveInput): string {
  const raw = readRaw(config, input);
  try {
    return assertTenantId(raw);
  } catch {
    throw new TenantResolutionError("Tenant id must be a lowercase identifier.", 400);
  }
}

export function tenantFromHost(hostHeader: string | undefined, baseDomain: string): string | undefined {
  if (!hostHeader) return undefined;
  const host = hostHeader.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
  const base = baseDomain.toLowerCase();
  if (!host || host === base) return undefined;
  const suffix = `.${base}`;
  if (!host.endsWith(suffix)) return undefined;
  const label = host.slice(0, -suffix.length);
  if (!label || label.includes(".")) return undefined;
  return label;
}

function readRaw(config: TenantIamConfig, input: ResolveInput): string {
  if (config.resolution.source === "jwt") {
    if (!input.token) throw new TenantResolutionError("Missing bearer token.", 401);
    const payload = decodeJwt(input.token) as Record<string, unknown>;
    const value = readClaim(payload, config.resolution.jwtClaim);
    if (typeof value !== "string" || !value.trim()) {
      throw new TenantResolutionError(`Tenant claim ${config.resolution.jwtClaim} is missing.`, 400);
    }
    return value.trim();
  }

  if (config.resolution.source === "header") {
    const header = first(input.header)?.trim();
    if (!header) {
      throw new TenantResolutionError(`Header ${config.resolution.headerName} is missing.`, 400);
    }
    return header;
  }

  const label = tenantFromHost(first(input.host), config.resolution.baseDomain);
  if (!label) {
    throw new TenantResolutionError("Host does not carry a tenant.", 400);
  }
  return label;
}

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#src/tenant/resolve.ts";
