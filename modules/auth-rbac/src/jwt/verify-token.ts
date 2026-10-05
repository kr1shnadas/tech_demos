/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from "jose";
import type { AuthUser } from "../access/evaluate-access.js";
import type { AuthModuleConfig } from "../config/auth-config.js";
import { extractRoles } from "./extract-roles.js";

export interface VerifyDeps {
  /** Injected key set. Tests and the demo identity provider use this. */
  localJwks?: JSONWebKeySet;
  jwks?: JWTVerifyGetKey;
}

const remoteKeys = new Map<string, JWTVerifyGetKey>();

export async function verifyAccessToken(
  token: string,
  config: AuthModuleConfig,
  deps: VerifyDeps = {},
): Promise<AuthUser> {
  const key = deps.jwks ?? (deps.localJwks ? createLocalJWKSet(deps.localJwks) : remoteKey(config.jwksUri));
  const { payload } = await jwtVerify(token, key, {
    issuer: config.issuer,
    clockTolerance: config.clockToleranceSeconds,
  });

  const audience = audienceList(payload.aud);
  const accepted = [config.audience, ...config.extraAudiences];
  if (!audience.some((value) => accepted.includes(value))) {
    throw new TokenRejectedError("Unexpected audience.");
  }

  const record = payload as Record<string, unknown>;
  return {
    sub: typeof payload.sub === "string" ? payload.sub : "",
    name: typeof record.name === "string" && record.name ? record.name : typeof payload.sub === "string" ? payload.sub : "",
    email: typeof record.email === "string" ? record.email : undefined,
    roles: extractRoles(record, config.rolesClaim, config.roleMap),
    issuer: typeof payload.iss === "string" ? payload.iss : config.issuer,
    audience,
    expiresAt: typeof payload.exp === "number" ? payload.exp : 0,
  };
}

export class TokenRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenRejectedError";
  }
}

function remoteKey(jwksUri: string): JWTVerifyGetKey {
  const cached = remoteKeys.get(jwksUri);
  if (cached) return cached;
  const created = createRemoteJWKSet(new URL(jwksUri));
  remoteKeys.set(jwksUri, created);
  return created;
}

function audienceList(aud: unknown): string[] {
  if (typeof aud === "string") return [aud];
  if (Array.isArray(aud)) return aud.filter((value): value is string => typeof value === "string");
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

export const buildFingerprint = "auth-rbac@0.1.0#src/jwt/verify-token.ts";
