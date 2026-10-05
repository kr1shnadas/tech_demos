/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { describe, expect, it } from "vitest";
import { defineAuthConfig } from "../src/config/auth-config.js";
import { TokenRejectedError, verifyAccessToken } from "../src/jwt/verify-token.js";
import { createTestIssuer, signAccessToken } from "./issuer.js";

describe("token validation", () => {
  it("accepts a signed token and reads the roles", async () => {
    const issuer = await createTestIssuer();
    const token = await signAccessToken(issuer, {
      sub: "clinician",
      name: "Meera Shah",
      email: "meera.shah@demo.local",
      roles: ["clinician"],
    });

    const user = await verifyAccessToken(token, issuer.config, { localJwks: issuer.localJwks });

    expect(user.sub).toBe("clinician");
    expect(user.name).toBe("Meera Shah");
    expect(user.roles).toEqual(["clinician"]);
    expect(user.audience).toEqual(["auth-rbac-demo"]);
  });

  it("rejects an expired token outside the clock tolerance", async () => {
    const issuer = await createTestIssuer();
    const token = await signAccessToken(
      issuer,
      { sub: "clinician", name: "Meera Shah", roles: ["clinician"] },
      { expiresIn: Math.floor(Date.now() / 1000) - 120 },
    );

    await expect(verifyAccessToken(token, issuer.config, { localJwks: issuer.localJwks })).rejects.toThrow(/"exp"/);
  });

  it("accepts a token that expired inside the clock tolerance", async () => {
    const issuer = await createTestIssuer();
    const token = await signAccessToken(
      issuer,
      { sub: "clinician", name: "Meera Shah", roles: ["clinician"] },
      { expiresIn: Math.floor(Date.now() / 1000) - 30 },
    );

    const user = await verifyAccessToken(token, issuer.config, { localJwks: issuer.localJwks });
    expect(user.sub).toBe("clinician");
  });

  it("rejects the wrong audience and the wrong issuer", async () => {
    const issuer = await createTestIssuer();
    const wrongAudience = await signAccessToken(
      issuer,
      { sub: "clinician", name: "Meera Shah", roles: ["clinician"] },
      { audience: "someone-else" },
    );
    const wrongIssuer = await signAccessToken(
      issuer,
      { sub: "clinician", name: "Meera Shah", roles: ["clinician"] },
      { issuer: "http://other.example" },
    );

    await expect(
      verifyAccessToken(wrongAudience, issuer.config, { localJwks: issuer.localJwks }),
    ).rejects.toBeInstanceOf(TokenRejectedError);
    await expect(verifyAccessToken(wrongIssuer, issuer.config, { localJwks: issuer.localJwks })).rejects.toThrow(
      /iss/,
    );
  });

  it("rejects a token signed by a different key", async () => {
    const issuer = await createTestIssuer();
    const other = await createTestIssuer();
    const token = await signAccessToken(other, {
      sub: "clinician",
      name: "Meera Shah",
      roles: ["clinician"],
    });

    await expect(verifyAccessToken(token, issuer.config, { localJwks: issuer.localJwks })).rejects.toThrow();
  });

  it("reads a nested Keycloak role claim and applies a role map", async () => {
    const issuer = await createTestIssuer();
    const config = defineAuthConfig(issuer.config, {
      rolesClaim: "realm_access.roles",
      roleMap: { "study-auditor": "auditor" },
    });
    const token = await signAccessToken(issuer, {
      sub: "auditor",
      name: "Owen Blake",
      extra: { realm_access: { roles: ["study-auditor"] } },
    });

    const user = await verifyAccessToken(token, config, { localJwks: issuer.localJwks });
    expect(user.roles).toEqual(["auditor"]);
  });
});

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#test/verify-token.spec.ts";
