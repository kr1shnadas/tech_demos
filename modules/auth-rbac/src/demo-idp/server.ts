/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { exportJWK, generateKeyPair, jwtVerify, SignJWT, createLocalJWKSet, type JWK } from "jose";
import { renderLoginPage, renderMessagePage } from "./page.js";
import { findDemoUser, type DemoUser } from "./users.js";

const DEFAULT_REDIRECTS = [
  "http://localhost:5173/callback",
  "http://127.0.0.1:5173/callback",
  "http://localhost:4200/callback",
  "http://127.0.0.1:4200/callback",
];

export interface DemoIdpOptions {
  issuer?: string;
  clientId?: string;
  audience?: string;
  redirectUris?: readonly string[];
  tokenTtlSeconds?: number;
}

export interface DemoIdentityProvider {
  server: Server;
  issuer: string;
  clientId: string;
  audience: string;
  publicJwk: JWK;
  close: () => Promise<void>;
}

interface Transaction {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
  expiresAt: number;
}

interface AuthCode {
  user: DemoUser;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number;
}

/**
 * Authorization-code + PKCE identity provider.
 * It signs RS256 access tokens and publishes a JWKS document, which is the
 * same check the API uses for Okta, Azure AD and Keycloak.
 */
export async function createDemoIdentityProvider(
  options: DemoIdpOptions = {},
): Promise<DemoIdentityProvider> {
  const issuer = (options.issuer ?? "http://localhost:4100").replace(/\/+$/, "");
  const clientId = options.clientId ?? "auth-rbac-demo";
  const audience = options.audience ?? "auth-rbac-demo";
  const redirectUris = new Set(options.redirectUris ?? DEFAULT_REDIRECTS);
  const tokenTtlSeconds = options.tokenTtlSeconds ?? 60 * 60;
  const kid = "demo-signing-1";

  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = kid;
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  const jwks = { keys: [publicJwk] };
  const localKeys = createLocalJWKSet(jwks);

  const transactions = new Map<string, Transaction>();
  const codes = new Map<string, AuthCode>();

  const server = createServer((req, res) => {
    void handle(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Request failed.";
      sendJson(req, res, 500, { error: "server_error", error_description: message });
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    sweep(transactions);
    sweep(codes);
    const url = new URL(req.url ?? "/", issuer);
    if (req.method === "OPTIONS") {
      applyCors(req, res);
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "GET" && url.pathname === "/.well-known/openid-configuration") {
      sendJson(req, res, 200, discovery(issuer));
      return;
    }
    if (req.method === "GET" && url.pathname === "/jwks") {
      sendJson(req, res, 200, jwks);
      return;
    }
    if (req.method === "GET" && url.pathname === "/authorize") {
      authorizeGet(url, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/authorize") {
      await authorizePost(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/token") {
      await tokenPost(req, res);
      return;
    }
    if (req.method === "GET" && url.pathname === "/userinfo") {
      await userInfo(req, res);
      return;
    }
    sendJson(req, res, 404, { error: "not_found" });
  }

  function authorizeGet(url: URL, res: ServerResponse): void {
    const redirectUri = url.searchParams.get("redirect_uri") ?? "";
    const trusted = redirectUris.has(redirectUri);
    const failure = validateAuthorizeQuery(url, clientId, redirectUris);
    if (failure) {
      if (trusted) {
        redirectError(res, redirectUri, failure, url.searchParams.get("state"));
        return;
      }
      sendHtml(res, 400, renderMessagePage("Cannot start sign-in", failure));
      return;
    }
    const id = randomBytes(24).toString("base64url");
    transactions.set(id, {
      clientId,
      redirectUri,
      state: url.searchParams.get("state") ?? "",
      codeChallenge: url.searchParams.get("code_challenge") ?? "",
      scope: url.searchParams.get("scope") ?? "openid",
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    res.setHeader("set-cookie", `idp_tx=${id}; HttpOnly; Path=/; SameSite=Lax; Max-Age=300`);
    sendHtml(res, 200, renderLoginPage({}));
  }

  async function authorizePost(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const txId = readCookie(req, "idp_tx");
    const tx = txId ? transactions.get(txId) : undefined;
    if (!tx || tx.expiresAt < Date.now()) {
      sendHtml(res, 400, renderMessagePage("Sign-in expired", "Start again from the application."));
      return;
    }
    const form = new URLSearchParams(await readBody(req));
    const user = findDemoUser(form.get("username") ?? "", form.get("password") ?? "");
    if (!user) {
      sendHtml(res, 401, renderLoginPage({ error: "Those credentials were not recognized." }));
      return;
    }
    const code = randomBytes(32).toString("base64url");
    codes.set(code, {
      user,
      clientId: tx.clientId,
      redirectUri: tx.redirectUri,
      codeChallenge: tx.codeChallenge,
      expiresAt: Date.now() + 2 * 60 * 1000,
    });
    transactions.delete(txId!);
    const target = new URL(tx.redirectUri);
    target.searchParams.set("code", code);
    target.searchParams.set("state", tx.state);
    res.writeHead(302, {
      location: target.toString(),
      "set-cookie": "idp_tx=; HttpOnly; Path=/; Max-Age=0",
    });
    res.end();
  }

  async function tokenPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const form = new URLSearchParams(await readBody(req));
    if (form.get("grant_type") !== "authorization_code") {
      sendJson(req, res, 400, { error: "unsupported_grant_type" });
      return;
    }
    const code = form.get("code") ?? "";
    const stored = codes.get(code);
    if (!stored || stored.expiresAt < Date.now()) {
      sendJson(req, res, 400, { error: "invalid_grant" });
      return;
    }
    if (form.get("client_id") !== stored.clientId || form.get("redirect_uri") !== stored.redirectUri) {
      sendJson(req, res, 400, { error: "invalid_grant" });
      return;
    }
    const verifier = form.get("code_verifier") ?? "";
    if (!pkceMatches(verifier, stored.codeChallenge)) {
      sendJson(req, res, 400, { error: "invalid_grant", error_description: "PKCE check failed." });
      return;
    }
    codes.delete(code);
    const accessToken = await new SignJWT({
      name: stored.user.name,
      email: stored.user.email,
      roles: stored.user.roles,
    })
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(issuer)
      .setSubject(stored.user.username)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(`${tokenTtlSeconds}s`)
      .sign(privateKey);

    sendJson(req, res, 200, {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: tokenTtlSeconds,
      scope: "openid profile email",
    });
  }

  async function userInfo(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const header = req.headers.authorization;
    const token = typeof header === "string" ? /^Bearer\s+(\S+)$/i.exec(header)?.[1] : undefined;
    if (!token) {
      sendJson(req, res, 401, { error: "invalid_token" });
      return;
    }
    try {
      const { payload } = await jwtVerify(token, localKeys, { issuer, audience });
      sendJson(req, res, 200, {
        sub: payload.sub,
        name: payload.name,
        email: payload.email,
        roles: payload.roles,
      });
    } catch {
      sendJson(req, res, 401, { error: "invalid_token" });
    }
  }

  return {
    server,
    issuer,
    clientId,
    audience,
    publicJwk,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function discovery(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    jwks_uri: `${issuer}/jwks`,
    userinfo_endpoint: `${issuer}/userinfo`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["openid", "profile", "email"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}

function validateAuthorizeQuery(url: URL, clientId: string, redirectUris: Set<string>): string | undefined {
  if (url.searchParams.get("client_id") !== clientId) return "Unknown client.";
  if (url.searchParams.get("response_type") !== "code") return "Only the authorization code flow is supported.";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  if (!redirectUris.has(redirectUri)) return "Redirect URI is not registered.";
  if (!url.searchParams.get("state")) return "Missing state.";
  if (url.searchParams.get("code_challenge_method") !== "S256") return "PKCE S256 is required.";
  if (!url.searchParams.get("code_challenge")) return "Missing PKCE challenge.";
  return undefined;
}

function redirectError(res: ServerResponse, redirectUri: string, message: string, state: string | null): void {
  const target = new URL(redirectUri);
  target.searchParams.set("error", "invalid_request");
  target.searchParams.set("error_description", message);
  if (state) target.searchParams.set("state", state);
  res.writeHead(302, { location: target.toString() });
  res.end();
}

function pkceMatches(verifier: string, challenge: string): boolean {
  if (!verifier) return false;
  const actual = createHash("sha256").update(verifier).digest("base64url");
  const left = Buffer.from(actual);
  const right = Buffer.from(challenge);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function readCookie(req: IncomingMessage, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sweep(store: Map<string, { expiresAt: number }>): void {
  const now = Date.now();
  for (const [key, value] of store) {
    if (value.expiresAt < now) store.delete(key);
  }
}

function applyCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (typeof origin === "string" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
  }
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "authorization, content-type");
}

function sendJson(req: IncomingMessage, res: ServerResponse, status: number, body: unknown): void {
  applyCors(req, res);
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(payload);
}

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#src/demo-idp/server.ts";
