/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export {
  authProviderNames,
  defaultAuthConfig,
  defineAuthConfig,
  toPublicAuthConfig,
  type AuthModuleConfig,
  type AuthProviderName,
  type ProviderPreset,
} from "./config/auth-config.js";
export { loadAuthConfig } from "./config/load-config.js";
export {
  azureAdProvider,
  keycloakProvider,
  localDemoProvider,
  oktaProvider,
  type AzureAdProviderOptions,
  type KeycloakProviderOptions,
  type LocalDemoProviderOptions,
  type OktaProviderOptions,
} from "./providers/index.js";
export { extractRoles, readClaim } from "./jwt/extract-roles.js";
export { TokenRejectedError, verifyAccessToken, type VerifyDeps } from "./jwt/verify-token.js";
export { evaluateAccess, type AccessDecision, type AuthUser } from "./access/evaluate-access.js";
export { AUTH_GUARD_OPTIONS, ROLES_KEY, type AuthGuardOptions } from "./nest/constants.js";
export { CurrentUser, Roles } from "./nest/decorators.js";
export { JwtAuthGuard, bearerToken } from "./nest/jwt-auth.guard.js";
export { RolesGuard } from "./nest/roles.guard.js";
export { AuthRbacModule } from "./nest/auth-rbac.module.js";

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#src/index.ts";
