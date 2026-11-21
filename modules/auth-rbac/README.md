<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 Krishna Das
See NOTICE at the repository root.
-->

# Authentication and role-based access

I have wired this the same way on CareTria, where the Angular client signs in with MSAL against Okta, and on platform APIs that only trust the access token. The route guard decides what a person sees. The API guard decides what they can call. This module is that slice, small enough to clone and run on its own.

It checks an OIDC access token (signature, issuer, audience, expiry) and then a role. Okta, Azure AD and Keycloak are plugins that fill in the issuer settings. A local identity provider is included so the demo runs without a cloud account.

## Setup

From the repository root, with Node.js 20 or newer:

```bash
pnpm install
pnpm --filter @krishnadas/auth-rbac dev
```

That one command starts four processes:

| Process | URL |
| --- | --- |
| Demo identity provider | http://localhost:4100 |
| Study API | http://localhost:4000 |
| React demo | http://127.0.0.1:5173 |
| Angular demo | http://127.0.0.1:4200 |

Open either demo, choose **Continue to sign in**, and pick an account. The password matches the username.

| Account | Password | Roles | What you can open |
| --- | --- | --- | --- |
| Meera Shah (`clinician`) | `clinician` | clinician | Study workspace. Audit review is denied. |
| Owen Blake (`auditor`) | `auditor` | auditor | Audit review. Study workspace is denied. |
| Krishna Das (`admin`) | `admin` | admin, clinician, auditor | Study workspace and audit review. |

Tests:

```bash
pnpm --filter @krishnadas/auth-rbac test
```

Copy `.env.example` to `.env` when you want to point the API at Okta, Azure AD or Keycloak. The demo pages read `GET /api/config`, so they follow the API.

## Usage

The package name is `@krishnadas/auth-rbac`. It is a private workspace package, so it is not on a public registry. In another package in this repository, depend on it and install from the root:

```json
{
  "dependencies": {
    "@krishnadas/auth-rbac": "workspace:*"
  }
}
```

```bash
pnpm install
```

Node.js 20 or newer. The export map points at TypeScript source (`src/index.ts`, `src/react/require-role.tsx`, `src/angular/role.guard.ts`), so the project that imports it has to compile that source. The demos do this with `tsx`, Vite and the Angular compiler.

To use the module in a different repository, copy `modules/auth-rbac` and point the dependency at that folder (`workspace:*` or `file:`). Keep the license header on the copied files, and keep the repository [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE) with the copy.

Import the Nest API from `@krishnadas/auth-rbac`. The React guard is `@krishnadas/auth-rbac/react`. The Angular guard is `@krishnadas/auth-rbac/angular`.

`defineAuthConfig(preset, overrides)` merges a provider preset with `Partial<AuthModuleConfig>`. `loadAuthConfig()` builds the same object from the environment. Defaults target the local demo. `AuthRbacModule.register` takes `{ config: AuthModuleConfig, localJwks?: JSONWebKeySet }`. Pass `localJwks` only when the process should trust a key set you already hold instead of fetching `jwksUri`.

```ts
import { Controller, Get, Module, UseGuards } from "@nestjs/common";
import {
  AuthRbacModule,
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  defineAuthConfig,
  oktaProvider,
  type AuthUser,
} from "@krishnadas/auth-rbac";

const authConfig = defineAuthConfig(
  oktaProvider({
    domain: "example.okta.com",
    clientId: "0oaExample",
    audience: "api://study",
  }),
  {
    roleMap: {
      "Study-Clinicians": "clinician",
      "Study-Auditors": "auditor",
      "Study-Admins": "admin",
    },
  },
);

@Controller("audit")
export class AuditController {
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("auditor", "admin")
  @Get()
  audit(@CurrentUser() user: AuthUser) {
    return user.name;
  }
}

@Module({
  imports: [AuthRbacModule.register({ config: authConfig })],
  controllers: [AuditController],
})
export class AppModule {}
```

Any listed role is enough. A route with no `@Roles()` only requires a valid token. A role claim may be an array, a single string, or a comma-separated string. `JwtAuthGuard` answers 401 when the bearer token is missing or invalid. `RolesGuard` answers 403 when none of the listed roles are on the token.

`loadAuthConfig()` is the other way to fill `config`, when the process should follow the environment instead of a preset written in code.

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `provider` | `"okta" \| "azure-ad" \| "keycloak" \| "local"` | `"local"` | Which preset built the issuer fields |
| `issuer` | `string` | `http://localhost:4100` | Expected `iss` claim |
| `audience` | `string` | `auth-rbac-demo` | Expected `aud` claim |
| `extraAudiences` | `readonly string[]` | `[]` | Accepted in addition to `audience` |
| `clientId` | `string` | `auth-rbac-demo` | Public client id |
| `jwksUri` | `string` | `http://localhost:4100/jwks` | Signing keys |
| `rolesClaim` | `string` | `"roles"` | Dot path of the role claim. The Keycloak preset uses `realm_access.roles`. The Okta preset uses `groups` |
| `scopes` | `readonly string[]` | `["openid", "profile", "email"]` | Sent on the authorize request |
| `clockToleranceSeconds` | `number` | `60` | Skew allowed when checking `exp` |
| `roleMap` | `Readonly<Record<string, string>>` | `{}` | Rename an identity-provider value into an application role. Unmapped values pass through |

The provider helpers return a `ProviderPreset`. Optional fields fall back as follows:

| Helper | Required | Defaults on the preset |
| --- | --- | --- |
| `oktaProvider` | `domain`, `clientId` | `authorizationServerId` `"default"`, `audience` `"api://default"`, `rolesClaim` `"groups"`. Issuer is `https://{domain}/oauth2/{server}` |
| `azureAdProvider` | `tenantId`, `clientId` | `audience` is the client id, `rolesClaim` is `"roles"`. Issuer is `https://login.microsoftonline.com/{tenant}/v2.0` |
| `keycloakProvider` | `baseUrl`, `realm`, `clientId` | `audience` is the client id, `rolesClaim` is `"realm_access.roles"`. Issuer is `{base}/realms/{realm}` |
| `localDemoProvider` | none | `baseUrl` `http://localhost:4100`, `clientId` and `audience` `auth-rbac-demo`, `rolesClaim` `"roles"` |

Environment variables use an `AUTH_` prefix: `AUTH_PROVIDER`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_CLIENT_ID`, `AUTH_JWKS_URI`, `AUTH_ROLES_CLAIM`, `AUTH_SCOPES`, `AUTH_CLOCK_TOLERANCE`, `AUTH_ROLE_MAP` (JSON object). Provider-specific variables:

| Provider | Variables | Issuer the plugin builds |
| --- | --- | --- |
| Okta | `OKTA_DOMAIN`, `OKTA_AUTH_SERVER_ID` (default `default`), `AUTH_CLIENT_ID` | `https://{domain}/oauth2/{server}` |
| Azure AD | `AZURE_TENANT_ID`, `AUTH_CLIENT_ID` | `https://login.microsoftonline.com/{tenant}/v2.0` |
| Keycloak | `KEYCLOAK_BASE_URL`, `KEYCLOAK_REALM` (default `study`), `AUTH_CLIENT_ID` | `{base}/realms/{realm}` |
| Local | `IDP_ISSUER` or `AUTH_ISSUER` | that URL |

React wraps the route element. `RequireRole` reads the access token from `sessionStorage` under the key `auth-rbac.access-token`. A missing or rejected token redirects to `/`. A valid token with the wrong role stays on the URL and renders `denied`.

```tsx
import { RequireRole } from "@krishnadas/auth-rbac/react";

<RequireRole
  roles={["auditor", "admin"]}
  config={authConfig}
  denied={(user) => <p>Denied for {user.name}</p>}
>
  <AuditPage />
</RequireRole>
```

Angular registers `requireRoles` as a `canActivate` guard. It uses the same session key. A missing role returns a `UrlTree` to `/denied`.

```ts
import { requireRoles } from "@krishnadas/auth-rbac/angular";

export const routes = [
  {
    path: "audit",
    canActivate: [requireRoles(["auditor", "admin"], authConfig)],
    component: AuditPage,
  },
];
```

## Design

I keep the vendor out of the guards. Each provider returns the same preset: issuer, JWKS URI, audience, client id, scopes and the claim that holds roles. `JwtAuthGuard` and the route guards call `verifyAccessToken`. `RolesGuard` and the route guards call `evaluateAccess`. Adding a provider means writing another preset, not another guard.

The Nest guards sit on the API because that is the check I trust. A person can change the browser. `JwtAuthGuard` rejects a missing or invalid bearer token with 401. `RolesGuard` runs after it, reads `@Roles()`, and answers 403 when the token does not carry any of those roles. The demo pages show that status code on the denied screen so the server decision is visible, not only the client one.

The React guard is a component around the route element. The URL stays on the forbidden screen and the guard swaps in the denied view. The Angular guard is a `CanActivateFn`. It returns a `UrlTree` to `/denied`, which is how I keep a forbidden page from activating. The two styles match the two frameworks I ship.

`roleMap` is there because the group name in Okta is often not the role name the API uses. I would rather map `Study-Clinicians` to `clinician` in one place than scatter string comparisons through the controllers.

The local provider is an authorization-code + PKCE server. It signs RS256 tokens and publishes `/.well-known/openid-configuration` and `/jwks`. The API validates those tokens the same way it would validate Okta or Keycloak: fetch the keys, check the signature, then issuer, audience and expiry. I would not point a real client at this process. The passwords are well known and the signing key lives only in memory for the life of the process.

Clock tolerance defaults to 60 seconds. Identity-provider clocks and API clocks drift, and a token that is a few seconds "early" or "late" should not bounce a signed-in person.

## Keycloak

The demo does not need Docker. When I want the Keycloak plugin against a real server:

```bash
docker compose up
```

Keycloak listens on http://localhost:8080 (admin console user `admin`, password `admin`) and imports the `study` realm. The same three accounts exist there. Point the API at it with the Keycloak block in `.env.example` and start `pnpm dev` again. The realm adds an audience mapper so the access token `aud` is `auth-rbac-demo`, which is the value the default config expects.

## Credit / attribution

This module is authored by Krishna Das ([github.com/kr1shnadas](https://github.com/kr1shnadas)).

Anyone who uses it must give credit to Krishna Das. That covers calling it from your own service and shipping a copy or a derivative. Keep the Apache-2.0 license header on the source files (`SPDX-License-Identifier: Apache-2.0` and `Copyright 2026 Krishna Das`). Keep the repository [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE) intact. Section 4(d) of the Apache License 2.0 is why the NOTICE stays: a redistribution or a derivative work has to retain that file and give visible credit to Krishna Das, in the source, in the documentation that goes with it, or on a display the work normally shows.

The license remains Apache-2.0. This section does not change it.
