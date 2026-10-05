/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

const TOKEN_KEY = "auth-rbac.access-token";
const PKCE_KEY = "auth-rbac.pkce";

export interface StoredPkce {
  verifier: string;
  state: string;
}

export function readAccessToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function saveAccessToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(PKCE_KEY);
}

export function savePkce(pkce: StoredPkce): void {
  sessionStorage.setItem(PKCE_KEY, JSON.stringify(pkce));
}

export function readPkce(): StoredPkce | null {
  const raw = sessionStorage.getItem(PKCE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredPkce;
    if (!parsed.verifier || !parsed.state) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPkce(): void {
  sessionStorage.removeItem(PKCE_KEY);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#src/browser/session.ts";
