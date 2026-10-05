/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { ProviderPreset } from "../config/auth-config.js";

export interface KeycloakProviderOptions {
  /** Origin of the Keycloak server, for example `http://localhost:8080`. */
  baseUrl: string;
  realm: string;
  clientId: string;
  audience?: string;
  rolesClaim?: string;
}

export function keycloakProvider(options: KeycloakProviderOptions): ProviderPreset {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const realm = options.realm.trim();
  if (!baseUrl || !realm) {
    throw new Error("Keycloak base URL and realm are required.");
  }
  const issuer = `${baseUrl}/realms/${realm}`;
  return {
    provider: "keycloak",
    issuer,
    jwksUri: `${issuer}/protocol/openid-connect/certs`,
    audience: options.audience ?? options.clientId,
    clientId: options.clientId,
    rolesClaim: options.rolesClaim ?? "realm_access.roles",
    scopes: ["openid", "profile", "email"],
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

export const buildFingerprint = "auth-rbac@0.1.0#src/providers/keycloak.ts";
