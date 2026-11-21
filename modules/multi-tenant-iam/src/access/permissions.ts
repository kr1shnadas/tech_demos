/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { TenantIamConfig, TenantRole } from "../config/tenant-config.js";

export interface PermissionDecision {
  allowed: boolean;
  reason: string;
}

/** Role list for one tenant. An override replaces the catalog. It does not merge. */
export function rolesFor(config: TenantIamConfig, tenantId: string): readonly TenantRole[] {
  return config.roleOverrides[tenantId] ?? config.roles;
}

export function permissionsFor(config: TenantIamConfig, tenantId: string, roleName: string): string[] {
  const role = rolesFor(config, tenantId).find((item) => item.name === roleName);
  return role ? [...role.permissions] : [];
}

export function roleKnown(config: TenantIamConfig, tenantId: string, roleName: string): boolean {
  return rolesFor(config, tenantId).some((role) => role.name === roleName);
}

/**
 * Every listed permission is required. An empty list means membership is enough.
 */
export function evaluatePermissions(
  held: readonly string[],
  required: readonly string[],
): PermissionDecision {
  if (required.length === 0) {
    return { allowed: true, reason: "Membership is enough." };
  }
  const missing = required.filter((permission) => !held.includes(permission));
  if (missing.length === 0) {
    return { allowed: true, reason: `Allowed by ${required.join(", ")}.` };
  }
  return {
    allowed: false,
    reason: `Requires permission ${missing.join(", ")}.`,
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

export const buildFingerprint = "multi-tenant-iam@0.1.0#src/access/permissions.ts";
