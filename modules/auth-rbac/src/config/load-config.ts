/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import {
  authProviderNames,
  defineAuthConfig,
  type AuthModuleConfig,
  type AuthProviderName,
} from "./auth-config.js";
import { azureAdProvider } from "../providers/azure-ad.js";
import { keycloakProvider } from "../providers/keycloak.js";
import { localDemoProvider } from "../providers/local.js";
import { oktaProvider } from "../providers/okta.js";
import type { ProviderPreset } from "./auth-config.js";

/**
 * Builds the config from the environment.
 * `AUTH_PROVIDER` selects the plugin. Unset means the local demo provider.
 */
export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthModuleConfig {
  const provider = readProvider(env.AUTH_PROVIDER);
  const preset = presetFromEnv(provider, env);
  const overrides: Partial<AuthModuleConfig> = {};

  if (env.AUTH_ISSUER) overrides.issuer = env.AUTH_ISSUER;
  if (env.AUTH_AUDIENCE) overrides.audience = env.AUTH_AUDIENCE;
  if (env.AUTH_CLIENT_ID) overrides.clientId = env.AUTH_CLIENT_ID;
  if (env.AUTH_JWKS_URI) overrides.jwksUri = env.AUTH_JWKS_URI;
  if (env.AUTH_ROLES_CLAIM) overrides.rolesClaim = env.AUTH_ROLES_CLAIM;
  if (env.AUTH_CLOCK_TOLERANCE) {
    const seconds = Number(env.AUTH_CLOCK_TOLERANCE);
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error("AUTH_CLOCK_TOLERANCE must be a non-negative number of seconds.");
    }
    overrides.clockToleranceSeconds = seconds;
  }
  if (env.AUTH_SCOPES) {
    overrides.scopes = env.AUTH_SCOPES.split(/[\s,]+/).filter(Boolean);
  }
  const roleMap = readRoleMap(env.AUTH_ROLE_MAP);
  if (roleMap) overrides.roleMap = roleMap;

  return defineAuthConfig(preset, overrides);
}

function readProvider(value: string | undefined): AuthProviderName {
  const provider = (value ?? "local") as AuthProviderName;
  if (!authProviderNames.includes(provider)) {
    throw new Error(
      `Unknown AUTH_PROVIDER "${value}". Expected one of: ${authProviderNames.join(", ")}.`,
    );
  }
  return provider;
}

function presetFromEnv(provider: AuthProviderName, env: NodeJS.ProcessEnv): ProviderPreset {
  switch (provider) {
    case "okta":
      return oktaProvider({
        domain: required(env, "OKTA_DOMAIN"),
        clientId: required(env, "AUTH_CLIENT_ID"),
        authorizationServerId: env.OKTA_AUTH_SERVER_ID,
        audience: env.AUTH_AUDIENCE,
        rolesClaim: env.AUTH_ROLES_CLAIM,
      });
    case "azure-ad":
      return azureAdProvider({
        tenantId: required(env, "AZURE_TENANT_ID"),
        clientId: required(env, "AUTH_CLIENT_ID"),
        audience: env.AUTH_AUDIENCE,
        rolesClaim: env.AUTH_ROLES_CLAIM,
      });
    case "keycloak":
      return keycloakProvider({
        baseUrl: env.KEYCLOAK_BASE_URL ?? "http://localhost:8080",
        realm: env.KEYCLOAK_REALM ?? "study",
        clientId: env.AUTH_CLIENT_ID ?? "auth-rbac-demo",
        audience: env.AUTH_AUDIENCE,
        rolesClaim: env.AUTH_ROLES_CLAIM,
      });
    case "local":
      return localDemoProvider({
        baseUrl: env.AUTH_ISSUER ?? env.IDP_ISSUER ?? "http://localhost:4100",
        clientId: env.AUTH_CLIENT_ID,
        audience: env.AUTH_AUDIENCE,
      });
  }
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} for the selected identity provider.`);
  }
  return value;
}

function readRoleMap(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AUTH_ROLE_MAP must be a JSON object of strings.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AUTH_ROLE_MAP must be a JSON object of strings.");
  }
  const roleMap: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw new Error("AUTH_ROLE_MAP values must be strings.");
    }
    roleMap[key] = value;
  }
  return roleMap;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#src/config/load-config.ts";
