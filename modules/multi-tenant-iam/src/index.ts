/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export { moduleVersion } from "./credit.js";
export {
  auditSinks,
  defaultTenantConfig,
  defineTenantConfig,
  isolationModes,
  tenantSources,
  toPublicTenantConfig,
  type AuditSettings,
  type AuditSinkName,
  type IsolationMode,
  type IsolationSettings,
  type PostgresSettings,
  type TenantConfigOverrides,
  type TenantIamConfig,
  type TenantResolution,
  type TenantRole,
  type TenantSource,
} from "./config/tenant-config.js";
export { loadTenantConfig } from "./config/load-config.js";
export { resolveTenantId, tenantFromHost, TenantResolutionError } from "./tenant/resolve.js";
export {
  evaluatePermissions,
  permissionsFor,
  roleKnown,
  rolesFor,
  type PermissionDecision,
} from "./access/permissions.js";
export { MemoryAuditSink } from "./audit/memory-sink.js";
export { PostgresAuditSink } from "./audit/postgres-sink.js";
export { type AuditEvent, type AuditSink, type AuditWrite } from "./audit/sink.js";
export { schemaNameForTenant, tenantSetting, TenantDb } from "./db/tenant-db.js";
export {
  TenantError,
  TenantStore,
  type MemberRow,
  type Membership,
  type NewRecord,
  type TenantInfo,
  type TenantRecord,
} from "./store/tenant-store.js";
export { AUDIT_SINK, PERMISSIONS_KEY, TENANT_DB, TENANT_IAM_CONFIG, TENANT_STORE } from "./nest/tokens.js";
export { CurrentTenant, RequirePermissions } from "./nest/decorators.js";
export { TenantGuard, type TenantAccess } from "./nest/tenant.guard.js";
export { PermissionsGuard } from "./nest/permissions.guard.js";
export {
  TenantIamModule,
  type TenantIamRegisterOptions,
  type TenantSeed,
  type TenantSeedScope,
} from "./nest/tenant-iam.module.js";

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#src/index.ts";
