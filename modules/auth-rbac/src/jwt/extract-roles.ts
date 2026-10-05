/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export function extractRoles(
  payload: Record<string, unknown>,
  rolesClaim: string,
  roleMap: Readonly<Record<string, string>> = {},
): string[] {
  const raw = readClaim(payload, rolesClaim);
  const values = normalizeRoleValues(raw).map((role) => roleMap[role] ?? role);
  return [...new Set(values)];
}

export function readClaim(payload: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = payload;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function normalizeRoleValues(raw: unknown): string[] {
  if (typeof raw === "string") {
    if (raw.includes(",")) {
      return raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    }
    return raw.trim() ? [raw.trim()] : [];
  }
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  }
  return [];
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#src/jwt/extract-roles.ts";
