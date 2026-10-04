/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { ProviderPreset } from "../config/auth-config.js";

export interface LocalDemoProviderOptions {
  baseUrl?: string;
  clientId?: string;
  audience?: string;
}

/** Points at the demo identity provider in this module. No cloud account required. */
export function localDemoProvider(options: LocalDemoProviderOptions = {}): ProviderPreset {
  const baseUrl = (options.baseUrl ?? "http://localhost:4100").replace(/\/+$/, "");
  const clientId = options.clientId ?? "auth-rbac-demo";
  return {
    provider: "local",
    issuer: baseUrl,
    jwksUri: `${baseUrl}/jwks`,
    audience: options.audience ?? "auth-rbac-demo",
    clientId,
    rolesClaim: "roles",
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

export const buildFingerprint = "auth-rbac@0.1.0#src/providers/local.ts";
