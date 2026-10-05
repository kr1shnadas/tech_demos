/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { type ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { evaluateAccess, type AuthUser } from "../access/evaluate-access.js";
import { clearAccessToken, readAccessToken } from "../browser/session.js";
import type { AuthModuleConfig } from "../config/auth-config.js";
import { verifyAccessToken } from "../jwt/verify-token.js";

export interface RequireRoleProps {
  roles: readonly string[];
  config: AuthModuleConfig;
  children: ReactNode;
  /** Rendered when the token is valid and the role is missing. */
  denied: (user: AuthUser) => ReactNode;
  pending?: ReactNode;
}

type Gate = "pending" | "anonymous" | "denied" | "ready";

/**
 * Route guard for React Router. Wrap the element of a protected route.
 * The URL stays put when the role is refused, and `denied` draws that screen.
 */
export function RequireRole({ roles, config, children, denied, pending }: RequireRoleProps) {
  const [gate, setGate] = useState<Gate>("pending");
  const [user, setUser] = useState<AuthUser | null>(null);
  const required = roles.join("|");

  useEffect(() => {
    let cancelled = false;
    const token = readAccessToken();
    if (!token) {
      setGate("anonymous");
      return;
    }
    const roleList = required ? required.split("|") : [];
    verifyAccessToken(token, config)
      .then((verified) => {
        if (cancelled) return;
        setUser(verified);
        setGate(evaluateAccess(verified, roleList).allowed ? "ready" : "denied");
      })
      .catch(() => {
        if (cancelled) return;
        clearAccessToken();
        setUser(null);
        setGate("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, [config, required]);

  if (gate === "pending") {
    return <>{pending ?? <p className="muted">Checking access…</p>}</>;
  }
  if (gate === "anonymous") {
    return <Navigate to="/" replace />;
  }
  if (gate === "denied" && user) {
    return <>{denied(user)}</>;
  }
  return <>{children}</>;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#src/react/require-role.tsx";
