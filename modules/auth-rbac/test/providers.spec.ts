/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { codeChallengeS256, randomUrlSafe } from "../src/browser/pkce.js";
import { defineAuthConfig } from "../src/config/auth-config.js";
import { loadAuthConfig } from "../src/config/load-config.js";
import { createDemoIdentityProvider, type DemoIdentityProvider } from "../src/demo-idp/server.js";
import { verifyAccessToken } from "../src/jwt/verify-token.js";
import { azureAdProvider } from "../src/providers/azure-ad.js";
import { keycloakProvider } from "../src/providers/keycloak.js";
import { localDemoProvider } from "../src/providers/local.js";
import { oktaProvider } from "../src/providers/okta.js";

describe("providers", () => {
  it("builds Okta, Azure AD, Keycloak and local issuer settings", () => {
    expect(oktaProvider({ domain: "https://dev-1.okta.com/", clientId: "client-1" })).toMatchObject({
      provider: "okta",
      issuer: "https://dev-1.okta.com/oauth2/default",
      jwksUri: "https://dev-1.okta.com/oauth2/default/v1/keys",
      audience: "api://default",
      rolesClaim: "groups",
      clientId: "client-1",
    });

    expect(azureAdProvider({ tenantId: "tenant-1", clientId: "app-1" })).toMatchObject({
      provider: "azure-ad",
      issuer: "https://login.microsoftonline.com/tenant-1/v2.0",
      jwksUri: "https://login.microsoftonline.com/tenant-1/discovery/v2.0/keys",
      audience: "app-1",
      rolesClaim: "roles",
    });

    expect(
      keycloakProvider({ baseUrl: "http://localhost:8080/", realm: "study", clientId: "auth-rbac-demo" }),
    ).toMatchObject({
      provider: "keycloak",
      issuer: "http://localhost:8080/realms/study",
      jwksUri: "http://localhost:8080/realms/study/protocol/openid-connect/certs",
      rolesClaim: "realm_access.roles",
      audience: "auth-rbac-demo",
    });

    expect(localDemoProvider()).toMatchObject({
      provider: "local",
      issuer: "http://localhost:4100",
      jwksUri: "http://localhost:4100/jwks",
    });
  });

  it("loads the local provider by default and reads an Okta override from the environment", () => {
    expect(loadAuthConfig({}).provider).toBe("local");
    const config = loadAuthConfig({
      AUTH_PROVIDER: "okta",
      OKTA_DOMAIN: "dev-9.okta.com",
      AUTH_CLIENT_ID: "client-9",
      AUTH_AUDIENCE: "api://study",
      AUTH_ROLE_MAP: "{\"Study-Clinicians\":\"clinician\"}",
    });
    expect(config.issuer).toBe("https://dev-9.okta.com/oauth2/default");
    expect(config.audience).toBe("api://study");
    expect(config.roleMap).toEqual({ "Study-Clinicians": "clinician" });
  });

  it("refuses an unknown provider", () => {
    expect(() => loadAuthConfig({ AUTH_PROVIDER: "other" })).toThrow(/AUTH_PROVIDER/);
  });
});

describe("demo identity provider", () => {
  let idp: DemoIdentityProvider | undefined;

  afterEach(async () => {
    if (idp) await idp.close();
    idp = undefined;
  });

  it("issues a token the API verifier accepts", async () => {
    const port = await freePort();
    const issuer = `http://127.0.0.1:${port}`;
    const redirectUri = "http://127.0.0.1:5173/callback";
    idp = await createDemoIdentityProvider({
      issuer,
      redirectUris: [redirectUri],
    });
    await listen(idp, port);

    const verifier = randomUrlSafe(32);
    const challenge = await codeChallengeS256(verifier);
    const authorize = new URL("/authorize", issuer);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", idp.clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("scope", "openid profile email");
    authorize.searchParams.set("state", "state-1");
    authorize.searchParams.set("code_challenge", challenge);
    authorize.searchParams.set("code_challenge_method", "S256");

    const login = await fetch(authorize, { redirect: "manual" });
    expect(login.status).toBe(200);
    const html = await login.text();
    expect(html).toContain("Meera Shah");
    const cookie = login.headers.getSetCookie().find((value) => value.startsWith("idp_tx="));
    expect(cookie).toBeTruthy();

    const posted = await fetch(new URL("/authorize", issuer), {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: cookie!.split(";")[0] ?? "",
      },
      body: new URLSearchParams({ username: "clinician", password: "clinician" }),
    });
    expect(posted.status).toBe(302);
    const location = new URL(posted.headers.get("location") ?? "");
    expect(location.searchParams.get("state")).toBe("state-1");
    const code = location.searchParams.get("code");
    expect(code).toBeTruthy();

    const tokenResponse = await fetch(new URL("/token", issuer), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code ?? "",
        redirect_uri: redirectUri,
        client_id: idp.clientId,
        code_verifier: verifier,
      }),
    });
    expect(tokenResponse.status).toBe(200);
    const tokenBody = (await tokenResponse.json()) as { access_token: string };

    const reused = await fetch(new URL("/token", issuer), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code ?? "",
        redirect_uri: redirectUri,
        client_id: idp.clientId,
        code_verifier: verifier,
      }),
    });
    expect(reused.status).toBe(400);

    const jwks = (await (await fetch(new URL("/jwks", issuer))).json()) as { keys: [] };
    const config = defineAuthConfig(localDemoProvider({ baseUrl: issuer, audience: idp.audience }));
    const user = await verifyAccessToken(tokenBody.access_token, config, { localJwks: jwks });
    expect(user.roles).toEqual(["clinician"]);
    expect(user.name).toBe("Meera Shah");
  });
});

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const stub = createServer();
    stub.listen(0, "127.0.0.1", () => {
      const address = stub.address();
      const port = typeof address === "object" && address ? address.port : 0;
      stub.close(() => resolve(port));
    });
    stub.on("error", reject);
  });
}

function listen(idp: DemoIdentityProvider, port: number): Promise<void> {
  return new Promise((resolve) => {
    idp.server.listen(port, "127.0.0.1", () => resolve());
  });
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#test/providers.spec.ts";
