/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import type { JSONWebKeySet } from "jose";
import type { AuthModuleConfig } from "../config/auth-config.js";

export const AUTH_GUARD_OPTIONS = "AUTH_GUARD_OPTIONS";

export interface AuthGuardOptions {
  config: AuthModuleConfig;
  /** When set, token checks use this key set instead of fetching `jwksUri`. */
  localJwks?: JSONWebKeySet;
}

export const ROLES_KEY = "auth-rbac:roles";

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#src/nest/constants.ts";
