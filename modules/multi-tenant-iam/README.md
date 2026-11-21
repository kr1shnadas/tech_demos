<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 Krishna Das
See NOTICE at the repository root.
-->

# Multi-tenant IAM

The study API serves more than one sponsor from one database. A closeout report once forgot the sponsor predicate and printed another sponsor's screen failures. I stopped trusting the predicate. This module sets the tenant on the connection and lets Postgres reject the other rows. It sits on the [auth module](../auth-rbac/): that module checks the access token, and this one decides which tenant the token is acting for and what that person may do there.

A person can be an owner in one tenant and a reader in another. The role lives on the membership row, not on the token. The token's role claim is ignored for these checks.

## Setup

From the repository root, with Node.js 20 or newer and Docker:

```bash
pnpm install
docker compose -f modules/multi-tenant-iam/docker-compose.yml up -d
pnpm --filter @krishnadas/multi-tenant-iam dev
```

| Process | URL |
| --- | --- |
| API | http://localhost:3000 |
| React desk | http://127.0.0.1:5173 |

Open the desk. It starts as Meera Shah in Northwind Labs.

| Person | Northwind Labs | Harbor Clinic |
| --- | --- | --- |
| Meera Shah | owner. Can add a record. | reader. Records and the audit trail open. Writing stays closed. |
| Owen Blake | no membership | member. Can add a record. |
| Krishna Das | owner | owner |

Switch the tenant. The records, the audit trail and the member list change with it. Add a record and the trail gains a `record.create` row for that tenant only. Owen has no Northwind membership, so the desk does not offer that tenant.

Postgres listens on localhost:5432 (`iam` / `iam`, database `iam`). The API creates a second role, `iam_app` / `iam_app`, and uses that for queries. The `iam` role owns the tables and is only used to migrate. Copy `.env.example` to `.env` in this directory when you want a different host or a different resolution source. Values already set in the environment win over the file.

Tests start their own Postgres. They do not use the Compose port.

```bash
pnpm --filter @krishnadas/multi-tenant-iam test
```

Stop the demo with `docker compose -f modules/multi-tenant-iam/docker-compose.yml down`.

## Usage

The package name is `@krishnadas/multi-tenant-iam`. It is a private workspace package, so it is not on a public registry. It depends on `@krishnadas/auth-rbac`. In another package in this repository, depend on it and install from the root:

```json
{
  "dependencies": {
    "@krishnadas/multi-tenant-iam": "workspace:*"
  }
}
```

```bash
pnpm install
```

Node.js 20 or newer, and Postgres. The export map points at `src/index.ts`, so the project that imports it has to compile that TypeScript. The demo uses `tsx`.

To use the module in a different repository, copy `modules/multi-tenant-iam` and `modules/auth-rbac`, and point the dependencies at those folders (`workspace:*` or `file:`). Keep the license header on the copied files, and keep the repository [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE) with the copy.

Import from `@krishnadas/multi-tenant-iam`. `JwtAuthGuard` still comes from `@krishnadas/auth-rbac`. `defineTenantConfig` merges overrides onto the defaults. Nested objects merge field by field, so setting `resolution.source` keeps the claim path and the header name. A `roles` override replaces the catalog. `loadTenantConfig()` does the same from the environment, and reads a `.env` file in the working directory when one is present. Values already set in the environment win over that file.

`TenantIamModule.register(config, options)` takes the tenant config and `{ auth: AuthGuardOptions, auditSink?: AuditSink, seed?: TenantSeed }`. `auth` is the same object `AuthRbacModule.register` takes (`{ config, localJwks? }`). The module imports that auth module for you. On init it calls `TenantDb.provision()`, then `seed` if you passed one. `seed` receives `{ store: TenantStore, db: TenantDb }`.

Pass `auditSink` when the trail should go somewhere other than the two built-in sinks. The sink's `append` is called on the same transaction as the change. `audit.sink: "memory"` uses `MemoryAuditSink`. `"postgres"` uses `PostgresAuditSink`.

```ts
import { Controller, Module, Post, UseGuards } from "@nestjs/common";
import {
  JwtAuthGuard,
  defineAuthConfig,
  localDemoProvider,
} from "@krishnadas/auth-rbac";
import {
  CurrentTenant,
  PermissionsGuard,
  RequirePermissions,
  TenantGuard,
  TenantIamModule,
  defineTenantConfig,
  type TenantAccess,
} from "@krishnadas/multi-tenant-iam";

const tenantConfig = defineTenantConfig({
  resolution: { source: "jwt", jwtClaim: "tenant_id" },
  isolation: { mode: "rls" },
  audit: { sink: "postgres" },
});

@Controller("records")
export class RecordsController {
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions("records.write")
  @Post()
  create(@CurrentTenant() tenant: TenantAccess) {
    return tenant.id;
  }
}

@Module({
  imports: [
    TenantIamModule.register(tenantConfig, {
      auth: { config: defineAuthConfig(localDemoProvider()) },
    }),
  ],
  controllers: [RecordsController],
})
export class AppModule {}
```

`TenantGuard` runs after `JwtAuthGuard`. `PermissionsGuard` reads `@RequirePermissions()`. Every listed permission is required. A route with no decorator only requires a membership in the resolved tenant. `TenantAccess` is `{ id, name, role, permissions, user }`. `user` is the `AuthUser` from the auth module.

Inject `TenantStore` when a service needs the records, the memberships or the audit list. The store runs those queries on a connection that already has the tenant set.

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `resolution.source` | `"jwt" \| "header" \| "subdomain"` | `"jwt"` | Where the tenant id is read. One source. It does not fall through |
| `resolution.jwtClaim` | `string` | `tenant_id` | Dot path of the tenant claim. Used when the source is `jwt` |
| `resolution.headerName` | `string` | `x-tenant-id` | Header name. Used when the source is `header` |
| `resolution.baseDomain` | `string` | `localhost` | `northwind.localhost` resolves to `northwind` |
| `isolation.mode` | `"rls" \| "schema"` | `"rls"` | One mode for records, memberships and the audit table |
| `roles` | `readonly TenantRole[]` | owner, member, reader | Catalog for a tenant with no override. `TenantRole` is `{ name: string, permissions: readonly string[] }`. Replacing the list replaces the whole catalog |
| `roleOverrides` | `Readonly<Record<string, readonly TenantRole[]>>` | `{}` | A tenant id mapped to a role list. That list replaces the catalog for that tenant |
| `audit.sink` | `"postgres" \| "memory"` | `"postgres"` | `postgres` writes the trail in the tenant scope. `memory` keeps it in the process, still split by tenant |
| `audit.table` | `string` | `audit_events` | Table used by the Postgres sink |
| `postgres.host` | `string` | `localhost` | Database host |
| `postgres.port` | `number` | `5432` | Database port |
| `postgres.user` | `string` | `iam` | Owner role. Used to migrate. Bypasses row security |
| `postgres.password` | `string` | `iam` | Owner password. This is the local demo password |
| `postgres.database` | `string` | `iam` | Database name |
| `postgres.appUser` | `string` | `iam_app` | Runtime role. Not a superuser, and not allowed to bypass row security |
| `postgres.appPassword` | `string` | `iam_app` | Runtime password. This is the local demo password |

The default catalog:

| Role | Permissions |
| --- | --- |
| `owner` | `records.read`, `records.write`, `audit.read`, `members.read` |
| `member` | `records.read`, `records.write`, `audit.read`, `members.read` |
| `reader` | `records.read`, `audit.read` |

Environment variables: `TENANT_SOURCE`, `TENANT_JWT_CLAIM`, `TENANT_HEADER`, `TENANT_BASE_DOMAIN`, `TENANT_ISOLATION`, `TENANT_ROLES` (JSON array), `TENANT_ROLE_OVERRIDES` (JSON object), `AUDIT_SINK`, `AUDIT_TABLE`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, `POSTGRES_APP_USER`, `POSTGRES_APP_PASSWORD`. `PORT` selects the API port and defaults to 3000.

## Design

The tenant id is a lowercase identifier, at most 40 characters. That keeps it safe to use as a schema name. I do not accept a second source as a fallback. A missing claim is a bad request, not a quiet switch to the header. Someone who can set a header should not be able to override a token I already checked.

`JwtAuthGuard` checks the signature, issuer, audience and expiry. `TenantGuard` reads the tenant only after that. For the `jwt` source it checks the token again and then reads the claim, so a guard wired in the wrong order cannot treat an unchecked token as a tenant. The membership lookup is the authorization decision. A valid token for a tenant the person does not belong to is a 403. The demo session route is the stand-in for the identity provider: it signs a short-lived token that carries `tenant_id`. A real deployment stamps that claim in the provider and leaves this route out.

Row-level security is the default because the study tables share one migration and I do not want a schema per sponsor until a sponsor needs its own dump boundary.

The policies compare `tenant_id` to `current_setting('app.tenant_id', true)`. The setting is applied with `set_config(..., true)` inside a transaction, which is `SET LOCAL`. When the transaction ends, the pooled connection does not keep the tenant. If the setting is missing, the comparison is unknown and the policy matches no rows. `WITH CHECK` rejects an insert or update that names another tenant. The record and audit queries do not add their own `WHERE tenant_id = ...`. If they did, a broken policy could hide behind the predicate.

The runtime role is `iam_app`. It is not a superuser, it does not have `BYPASSRLS`, and it does not inherit other roles. The table owner does bypass row security, even with `FORCE ROW LEVEL SECURITY`, when that owner is a superuser. The official Postgres image makes `POSTGRES_USER` a superuser, so the migrate connection and the query connection have to be different roles. I force row security anyway, so a later change of ownership does not silently turn the policy off for a non-superuser owner.

Schema-per-tenant is the other mode. Each tenant gets a schema named `tenant_<id>` and a `NOLOGIN` role of the same name. That role is granted only its own schema. `iam_app` is granted the role but marked `NOINHERIT`, so the grant does nothing until the request runs `SET LOCAL ROLE`. A query that spells the other schema, `tenant_bravo.records`, is permission denied. Search path alone would not do that: the app role could still open the other schema by name. Migrations have to be applied to every schema. `provision` does that for tenants it already knows, and creating a tenant creates the schema. A single-tenant `pg_dump -n tenant_northwind` is the operational reason I would pick this mode. It costs a catalog entry per tenant and a migration fan-out. Cross-tenant reporting becomes an explicit owner query, which is what I want, and it is also more work.

I would not mix the two. `isolation.mode` picks one for the records, the memberships and the audit table. The tenant directory stays in `public.tenants` either way, so a request can resolve a tenant name before it enters that tenant's scope.

The audit row is inserted on the same transaction as the record. Roll the record back and the trail rolls back with it. The Postgres sink selects with no tenant predicate, same as the record list. The memory sink is there for a process that has no database trail yet. It still partitions by tenant id. It will not survive a restart, and it is not a substitute for the policy.

## Credit / attribution

This module is authored by Krishna Das ([github.com/kr1shnadas](https://github.com/kr1shnadas)).

Anyone who uses it must give credit to Krishna Das. That covers calling it from your own service and shipping a copy or a derivative. Keep the Apache-2.0 license header on the source files (`SPDX-License-Identifier: Apache-2.0` and `Copyright 2026 Krishna Das`). Keep the repository [LICENSE](../../LICENSE) and [NOTICE](../../NOTICE) intact. Section 4(d) of the Apache License 2.0 is why the NOTICE stays: a redistribution or a derivative work has to retain that file and give visible credit to Krishna Das, in the source, in the documentation that goes with it, or on a display the work normally shows.

The license remains Apache-2.0. This section does not change it.
