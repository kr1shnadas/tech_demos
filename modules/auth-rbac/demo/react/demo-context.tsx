/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser } from "../../src/access/evaluate-access.js";
import { clearAccessToken, readAccessToken } from "../../src/browser/session.js";
import { defaultAuthConfig, type AuthModuleConfig } from "../../src/config/auth-config.js";
import { verifyAccessToken } from "../../src/jwt/verify-token.js";
import { callApi } from "../shared/api.js";

interface DemoState {
  config: AuthModuleConfig;
  user: AuthUser | null;
  ready: boolean;
  configError: string;
  refresh: () => Promise<void>;
  signOut: () => void;
}

const DemoContext = createContext<DemoState | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AuthModuleConfig>(defaultAuthConfig);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [configError, setConfigError] = useState("");

  const refresh = useCallback(async () => {
    const loaded = await callApi("/api/config");
    const next = isConfig(loaded.body) ? loaded.body : defaultAuthConfig;
    if (!isConfig(loaded.body)) {
      setConfigError("The API did not return a configuration. Using the local defaults.");
    } else {
      setConfigError("");
    }
    setConfig(next);
    const token = readAccessToken();
    if (!token) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      setUser(await verifyAccessToken(token, next));
    } catch {
      clearAccessToken();
      setUser(null);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(() => {
    clearAccessToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ config, user, ready, configError, refresh, signOut }),
    [config, user, ready, configError, refresh, signOut],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoState {
  const value = useContext(DemoContext);
  if (!value) throw new Error("DemoProvider is missing.");
  return value;
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

export const buildFingerprint = "auth-rbac@0.1.0#demo/react/demo-context.tsx";
