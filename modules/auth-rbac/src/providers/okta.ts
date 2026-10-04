/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { ProviderPreset } from "../config/auth-config.js";

export interface OktaProviderOptions {
  /** Org host, for example `dev-12345.okta.com`. A scheme is accepted and stripped. */
  domain: string;
  clientId: string;
  /** Custom authorization server id. The org server is `default`. */
  authorizationServerId?: string;
  audience?: string;
  /** Okta groups usually live on `groups`, not `roles`. */
  rolesClaim?: string;
}

export function oktaProvider(options: OktaProviderOptions): ProviderPreset {
  const domain = options.domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!domain) {
    throw new Error("Okta domain is required.");
  }
  const serverId = options.authorizationServerId ?? "default";
  const issuer = `https://${domain}/oauth2/${serverId}`;
  return {
    provider: "okta",
    issuer,
    jwksUri: `${issuer}/v1/keys`,
    audience: options.audience ?? "api://default",
    clientId: options.clientId,
    rolesClaim: options.rolesClaim ?? "groups",
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

export const buildFingerprint = "auth-rbac@0.1.0#src/providers/okta.ts";
