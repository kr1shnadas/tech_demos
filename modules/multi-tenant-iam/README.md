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

## Configuration

`defineTenantConfig` merges overrides onto the defaults. Nested objects merge field by field, so setting `resolution.source` keeps the claim path and the header name. A `roles` override replaces the catalog. `loadTenantConfig` does the same from the environment.

```ts
import { Module } from "@nestjs/common";
import { defineAuthConfig, localDemoProvider } from "@krishnadas/auth-rbac";
import { defineTenantConfig, TenantIamModule } from "@krishnadas/multi-tenant-iam";

const tenantConfig = defineTenantConfig({
  resolution: { source: "jwt", jwtClaim: "tenant_id" },
  isolation: { mode: "rls" },
  audit: { sink: "postgres" },
});

@Module({
  imports: [
    TenantIamModule.register(tenantConfig, {
      auth: { config: defineAuthConfig(localDemoProvider()) },
    }),
  ],
})
export class AppModule {}
```

On a route:

```ts
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@RequirePermissions("records.write")
@Post("records")
create(@CurrentTenant() tenant: TenantAccess) {
  return tenant.id;
}
```

`JwtAuthGuard` comes from the auth module. `TenantGuard` runs after it. `PermissionsGuard` reads `@RequirePermissions()`. Every listed permission is required. A route with no decorator only requires a membership in the resolved tenant.

| Field | Default | Meaning |
| --- | --- | --- |
| `resolution.source` | `jwt` | `jwt`, `header` or `subdomain`. One source. It does not fall through |
| `resolution.jwtClaim` | `tenant_id` | Dot path of the tenant claim. Used when the source is `jwt` |
| `resolution.headerName` | `x-tenant-id` | Header name. Used when the source is `header` |
| `resolution.baseDomain` | `localhost` | `northwind.localhost` resolves to `northwind` |
| `isolation.mode` | `rls` | `rls` or `schema` |
| `roles` | owner, member, reader | Catalog for a tenant with no override. Replacing it replaces the whole list |
| `roleOverrides` | empty | A tenant id mapped to a role list. That list replaces the catalog for that tenant |
| `audit.sink` | `postgres` | `postgres` writes the trail in the tenant scope. `memory` keeps it in the process, still split by tenant |
| `audit.table` | `audit_events` | Table used by the Postgres sink |
| `postgres.host` | `localhost` | Database host |
| `postgres.port` | `5432` | Database port |
| `postgres.user` | `iam` | Owner role. Used to migrate. Bypasses row security |
| `postgres.password` | `iam` | Owner password. This is the local demo password |
| `postgres.database` | `iam` | Database name |
| `postgres.appUser` | `iam_app` | Runtime role. Not a superuser, and not allowed to bypass row security |
| `postgres.appPassword` | `iam_app` | Runtime password. This is the local demo password |

The default catalog:

| Role | Permissions |
| --- | --- |
| `owner` | `records.read`, `records.write`, `audit.read`, `members.read` |
| `member` | `records.read`, `records.write`, `audit.read`, `members.read` |
| `reader` | `records.read`, `audit.read` |

Environment variables: `TENANT_SOURCE`, `TENANT_JWT_CLAIM`, `TENANT_HEADER`, `TENANT_BASE_DOMAIN`, `TENANT_ISOLATION`, `TENANT_ROLES` (JSON array), `TENANT_ROLE_OVERRIDES` (JSON object), `AUDIT_SINK`, `AUDIT_TABLE`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, `POSTGRES_APP_USER`, `POSTGRES_APP_PASSWORD`. `PORT` selects the API port and defaults to 3000.

Pass `auditSink` to `TenantIamModule.register` when the trail should go somewhere other than the two built-in sinks. The sink's `append` is called on the same transaction as the change.

## Design

The tenant id is a lowercase identifier, at most 40 characters. That keeps it safe to use as a schema name. I do not accept a second source as a fallback. A missing claim is a bad request, not a quiet switch to the header. Someone who can set a header should not be able to override a token I already checked.

`JwtAuthGuard` checks the signature, issuer, audience and expiry. `TenantGuard` reads the tenant only after that. For the `jwt` source it checks the token again and then reads the claim, so a guard wired in the wrong order cannot treat an unchecked token as a tenant. The membership lookup is the authorization decision. A valid token for a tenant the person does not belong to is a 403. The demo session route is the stand-in for the identity provider: it signs a short-lived token that carries `tenant_id`. A real deployment stamps that claim in the provider and leaves this route out.

Row-level security is the default because the study tables share one migration and I do not want a schema per sponsor until a sponsor needs its own dump boundary.

The policies compare `tenant_id` to `current_setting('app.tenant_id', true)`. The setting is applied with `set_config(..., true)` inside a transaction, which is `SET LOCAL`. When the transaction ends, the pooled connection does not keep the tenant. If the setting is missing, the comparison is unknown and the policy matches no rows. `WITH CHECK` rejects an insert or update that names another tenant. The record and audit queries do not add their own `WHERE tenant_id = ...`. If they did, a broken policy could hide behind the predicate.

The runtime role is `iam_app`. It is not a superuser, it does not have `BYPASSRLS`, and it does not inherit other roles. The table owner does bypass row security, even with `FORCE ROW LEVEL SECURITY`, when that owner is a superuser. The official Postgres image makes `POSTGRES_USER` a superuser, so the migrate connection and the query connection have to be different roles. I force row security anyway, so a later change of ownership does not silently turn the policy off for a non-superuser owner.

Schema-per-tenant is the other mode. Each tenant gets a schema named `tenant_<id>` and a `NOLOGIN` role of the same name. That role is granted only its own schema. `iam_app` is granted the role but marked `NOINHERIT`, so the grant does nothing until the request runs `SET LOCAL ROLE`. A query that spells the other schema, `tenant_bravo.records`, is permission denied. Search path alone would not do that: the app role could still open the other schema by name. Migrations have to be applied to every schema. `provision` does that for tenants it already knows, and creating a tenant creates the schema. A single-tenant `pg_dump -n tenant_northwind` is the operational reason I would pick this mode. It costs a catalog entry per tenant and a migration fan-out. Cross-tenant reporting becomes an explicit owner query, which is what I want, and it is also more work.

I would not mix the two. `isolation.mode` picks one for the records, the memberships and the audit table. The tenant directory stays in `public.tenants` either way, so a request can resolve a tenant name before it enters that tenant's scope.

The audit row is inserted on the same transaction as the record. Roll the record back and the trail rolls back with it. The Postgres sink selects with no tenant predicate, same as the record list. The memory sink is there for a process that has no database trail yet. It still partitions by tenant id. It will not survive a restart, and it is not a substitute for the policy.

## License

Apache-2.0. See [NOTICE](../../NOTICE) at the repository root. Copyright 2026 Krishna Das.
