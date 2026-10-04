/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { AuthModuleConfig } from "../config/auth-config.js";
import { codeChallengeS256, randomUrlSafe } from "./pkce.js";
import { clearPkce, readPkce, saveAccessToken, savePkce } from "./session.js";

export async function beginSignIn(config: AuthModuleConfig, redirectUri: string): Promise<void> {
  const verifier = randomUrlSafe(32);
  const state = randomUrlSafe(16);
  const challenge = await codeChallengeS256(verifier);
  savePkce({ verifier, state });
  const url = new URL("/authorize", config.issuer);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  window.location.assign(url.toString());
}

export async function completeSignIn(
  config: AuthModuleConfig,
  redirectUri: string,
  query: URLSearchParams,
): Promise<void> {
  const error = query.get("error");
  if (error) {
    throw new Error(query.get("error_description") ?? "Sign-in was cancelled.");
  }
  const code = query.get("code");
  const state = query.get("state");
  const pkce = readPkce();
  if (!code || !state || !pkce) {
    throw new Error("Sign-in response was incomplete.");
  }
  if (pkce.state !== state) {
    throw new Error("Sign-in state did not match.");
  }

  const response = await fetch(new URL("/token", config.issuer), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      code_verifier: pkce.verifier,
    }),
  });
  if (!response.ok) {
    throw new Error("The identity provider rejected the code exchange.");
  }
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("The identity provider did not return an access token.");
  }
  saveAccessToken(payload.access_token);
  clearPkce();
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#src/browser/sign-in.ts";
