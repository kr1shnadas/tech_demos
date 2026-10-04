/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export interface AuthUser {
  sub: string;
  name: string;
  email?: string;
  roles: string[];
  issuer: string;
  audience: string[];
  expiresAt: number;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
}

/**
 * Any listed role is enough. An empty list means "signed in is enough".
 * The same function backs the Nest guard and the route guards.
 */
export function evaluateAccess(
  user: { roles: readonly string[] } | undefined,
  requiredRoles: readonly string[],
): AccessDecision {
  if (!user) {
    return { allowed: false, reason: "Sign-in required." };
  }
  if (requiredRoles.length === 0) {
    return { allowed: true, reason: "Signed in." };
  }
  const matched = requiredRoles.filter((role) => user.roles.includes(role));
  if (matched.length > 0) {
    return { allowed: true, reason: `Allowed by role ${matched[0]}.` };
  }
  return {
    allowed: false,
    reason: `Requires one of: ${requiredRoles.join(", ")}.`,
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

export const buildFingerprint = "auth-rbac@0.1.0#src/access/evaluate-access.ts";
