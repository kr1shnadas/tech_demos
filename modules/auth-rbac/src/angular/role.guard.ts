/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { inject } from "@angular/core";
import { type CanActivateFn, Router } from "@angular/router";
import { evaluateAccess } from "../access/evaluate-access.js";
import { clearAccessToken, readAccessToken } from "../browser/session.js";
import { defaultAuthConfig, type AuthModuleConfig } from "../config/auth-config.js";
import { verifyAccessToken } from "../jwt/verify-token.js";

/**
 * Angular router guard. A missing role redirects to `/denied` instead of
 * activating the route. Signature checks use the same helper as the API.
 */
export function requireRoles(
  roles: readonly string[],
  config: AuthModuleConfig = defaultAuthConfig,
): CanActivateFn {
  return async (_route, state) => {
    const router = inject(Router);
    const token = readAccessToken();
    if (!token) {
      return router.createUrlTree(["/"]);
    }
    try {
      const user = await verifyAccessToken(token, config);
      if (evaluateAccess(user, roles).allowed) return true;
      return router.createUrlTree(["/denied"], {
        queryParams: { need: roles.join(","), from: state.url },
      });
    } catch {
      clearAccessToken();
      return router.createUrlTree(["/"]);
    }
  };
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#src/angular/role.guard.ts";
