/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export { azureAdProvider, type AzureAdProviderOptions } from "./azure-ad.js";
export { keycloakProvider, type KeycloakProviderOptions } from "./keycloak.js";
export { localDemoProvider, type LocalDemoProviderOptions } from "./local.js";
export { oktaProvider, type OktaProviderOptions } from "./okta.js";

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#src/providers/index.ts";
