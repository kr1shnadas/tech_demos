/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { ProviderPreset } from "../config/auth-config.js";

export interface AzureAdProviderOptions {
  tenantId: string;
  clientId: string;
  /**
   * Application ID URI of the API, often `api://{clientId}` or the client id itself.
   * The access token `aud` must match this value.
   */
  audience?: string;
  rolesClaim?: string;
}

export function azureAdProvider(options: AzureAdProviderOptions): ProviderPreset {
  const tenantId = options.tenantId.trim();
  if (!tenantId) {
    throw new Error("Azure AD tenant id is required.");
  }
  const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  return {
    provider: "azure-ad",
    issuer,
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    audience: options.audience ?? options.clientId,
    clientId: options.clientId,
    rolesClaim: options.rolesClaim ?? "roles",
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

export const buildFingerprint = "auth-rbac@0.1.0#src/providers/azure-ad.ts";
