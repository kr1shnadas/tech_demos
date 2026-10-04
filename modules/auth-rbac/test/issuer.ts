/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { exportJWK, generateKeyPair, SignJWT, type JSONWebKeySet } from "jose";
import { defineAuthConfig, type AuthModuleConfig } from "../src/config/auth-config.js";
import { localDemoProvider } from "../src/providers/local.js";

export interface TestIssuer {
  privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
  localJwks: JSONWebKeySet;
  config: AuthModuleConfig;
}

export async function createTestIssuer(): Promise<TestIssuer> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test-1";
  jwk.alg = "RS256";
  jwk.use = "sig";
  const config = defineAuthConfig(
    localDemoProvider({
      baseUrl: "http://issuer.test",
      clientId: "auth-rbac-demo",
      audience: "auth-rbac-demo",
    }),
  );
  return { privateKey, localJwks: { keys: [jwk] }, config };
}

export async function signAccessToken(
  issuer: TestIssuer,
  claims: { sub: string; name: string; email?: string; roles?: string[]; extra?: Record<string, unknown> },
  overrides: { audience?: string; issuer?: string; expiresIn?: string | number } = {},
): Promise<string> {
  return new SignJWT({
    name: claims.name,
    email: claims.email,
    roles: claims.roles ?? [],
    ...claims.extra,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-1" })
    .setSubject(claims.sub)
    .setIssuer(overrides.issuer ?? issuer.config.issuer)
    .setAudience(overrides.audience ?? issuer.config.audience)
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? "1h")
    .sign(issuer.privateKey);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#test/issuer.ts";
