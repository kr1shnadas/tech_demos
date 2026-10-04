/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Injectable, signal } from "@angular/core";
import type { AuthUser } from "../../../../src/access/evaluate-access.js";
import { clearAccessToken, readAccessToken } from "../../../../src/browser/session.js";
import { defaultAuthConfig, type AuthModuleConfig } from "../../../../src/config/auth-config.js";
import { verifyAccessToken } from "../../../../src/jwt/verify-token.js";
import { callApi } from "../../../shared/api.js";

@Injectable({ providedIn: "root" })
export class SessionStore {
  readonly config = signal<AuthModuleConfig>(defaultAuthConfig);
  readonly user = signal<AuthUser | null>(null);
  readonly configError = signal("");

  async bootstrap(): Promise<void> {
    const loaded = await callApi("/api/config");
    if (isConfig(loaded.body)) {
      this.config.set(loaded.body);
      this.configError.set("");
    } else {
      this.configError.set("The API did not return a configuration. Using the local defaults.");
    }
    await this.refreshUser();
  }

  async refreshUser(): Promise<void> {
    const token = readAccessToken();
    if (!token) {
      this.user.set(null);
      return;
    }
    try {
      this.user.set(await verifyAccessToken(token, this.config()));
    } catch {
      clearAccessToken();
      this.user.set(null);
    }
  }

  signOut(): void {
    clearAccessToken();
    this.user.set(null);
  }
}

function isConfig(value: unknown): value is AuthModuleConfig {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.issuer === "string" &&
    typeof record.audience === "string" &&
    typeof record.clientId === "string" &&
    typeof record.jwksUri === "string" &&
    typeof record.rolesClaim === "string" &&
    Array.isArray(record.scopes)
  );
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#demo/angular/src/app/session.service.ts";
