/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export const authProviderNames = ["okta", "azure-ad", "keycloak", "local"] as const;

export type AuthProviderName = (typeof authProviderNames)[number];

/**
 * Everything a guard needs to trust an access token.
 * Provider plugins fill the issuer fields. The rest has defaults.
 */
export interface AuthModuleConfig {
  provider: AuthProviderName;
  issuer: string;
  audience: string;
  clientId: string;
  jwksUri: string;
  /** Dot path into the token payload. Keycloak uses `realm_access.roles`. */
  rolesClaim: string;
  scopes: readonly string[];
  clockToleranceSeconds: number;
  /**
   * Rename an identity-provider value into an application role.
   * Unmapped values are kept as they appear on the token.
   */
  roleMap: Readonly<Record<string, string>>;
  /** Accepted in addition to `audience`. Useful when Azure AD stamps more than one. */
  extraAudiences: readonly string[];
}

export interface ProviderPreset {
  provider: AuthProviderName;
  issuer: string;
  audience: string;
  clientId: string;
  jwksUri: string;
  rolesClaim: string;
  scopes?: readonly string[];
}

export const defaultAuthConfig: AuthModuleConfig = {
  provider: "local",
  issuer: "http://localhost:4100",
  audience: "auth-rbac-demo",
  clientId: "auth-rbac-demo",
  jwksUri: "http://localhost:4100/jwks",
  rolesClaim: "roles",
  scopes: ["openid", "profile", "email"],
  clockToleranceSeconds: 60,
  roleMap: {},
  extraAudiences: [],
};

export function defineAuthConfig(
  preset: ProviderPreset,
  overrides: Partial<AuthModuleConfig> = {},
): AuthModuleConfig {
  const merged: AuthModuleConfig = {
    ...defaultAuthConfig,
    provider: preset.provider,
    issuer: preset.issuer,
    audience: preset.audience,
    clientId: preset.clientId,
    jwksUri: preset.jwksUri,
    rolesClaim: preset.rolesClaim,
    scopes: preset.scopes ?? defaultAuthConfig.scopes,
    ...defined(overrides),
  };
  assertHttpUrl("issuer", merged.issuer);
  assertHttpUrl("jwksUri", merged.jwksUri);
  if (!merged.audience) {
    throw new Error("audience is required.");
  }
  if (!merged.clientId) {
    throw new Error("clientId is required.");
  }
  if (!merged.rolesClaim) {
    throw new Error("rolesClaim is required.");
  }
  if (!Number.isFinite(merged.clockToleranceSeconds) || merged.clockToleranceSeconds < 0) {
    throw new Error("clockToleranceSeconds must be a non-negative number.");
  }
  return merged;
}

export function toPublicAuthConfig(config: AuthModuleConfig): AuthModuleConfig {
  return {
    provider: config.provider,
    issuer: config.issuer,
    audience: config.audience,
    clientId: config.clientId,
    jwksUri: config.jwksUri,
    rolesClaim: config.rolesClaim,
    scopes: [...config.scopes],
    clockToleranceSeconds: config.clockToleranceSeconds,
    roleMap: { ...config.roleMap },
    extraAudiences: [...config.extraAudiences],
  };
}

function defined(overrides: Partial<AuthModuleConfig>): Partial<AuthModuleConfig> {
  return Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as Partial<AuthModuleConfig>;
}

function assertHttpUrl(name: string, value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an http(s) URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} must be an http(s) URL.`);
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

export const buildFingerprint = "auth-rbac@0.1.0#src/config/auth-config.ts";
