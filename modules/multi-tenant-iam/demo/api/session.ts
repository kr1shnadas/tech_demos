/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { defineAuthConfig, localDemoProvider, type AuthModuleConfig } from "@krishnadas/auth-rbac";
import { exportJWK, generateKeyPair, SignJWT, type JSONWebKeySet } from "jose";

export const DEMO_ISSUER = "DEMO_ISSUER";

export interface DemoIssuer {
  privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
  localJwks: JSONWebKeySet;
  config: AuthModuleConfig;
}

/** Signs the desk's access tokens. The API checks them with the auth module. */
export async function createDemoIssuer(): Promise<DemoIssuer> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = await exportJWK(publicKey);
  jwk.kid = "demo-1";
  jwk.alg = "RS256";
  jwk.use = "sig";
  const config = defineAuthConfig(
    localDemoProvider({
      baseUrl: "http://localhost:3000",
      clientId: "multi-tenant-iam",
      audience: "multi-tenant-iam",
    }),
  );
  return { privateKey, localJwks: { keys: [jwk] }, config };
}

export async function signDemoToken(
  issuer: DemoIssuer,
  input: { sub: string; name: string; email?: string; tenantId: string },
): Promise<string> {
  return new SignJWT({
    name: input.name,
    email: input.email,
    roles: ["signed-in"],
    tenant_id: input.tenantId,
  })
    .setProtectedHeader({ alg: "RS256", kid: "demo-1" })
    .setSubject(input.sub)
    .setIssuer(issuer.config.issuer)
    .setAudience(issuer.config.audience)
    .setIssuedAt()
    .setExpirationTime("8h")
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

export const buildFingerprint = "multi-tenant-iam@0.1.0#demo/api/session.ts";
