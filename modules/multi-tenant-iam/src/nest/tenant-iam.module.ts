/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Inject, Injectable, Module, type DynamicModule, type OnModuleInit } from "@nestjs/common";
import { AuthRbacModule, type AuthGuardOptions } from "@krishnadas/auth-rbac";
import { MemoryAuditSink } from "../audit/memory-sink.js";
import { PostgresAuditSink } from "../audit/postgres-sink.js";
import type { AuditSink } from "../audit/sink.js";
import type { TenantIamConfig } from "../config/tenant-config.js";
import { TenantDb } from "../db/tenant-db.js";
import { TenantStore } from "../store/tenant-store.js";
import { PermissionsGuard } from "./permissions.guard.js";
import { TenantGuard } from "./tenant.guard.js";
import { AUDIT_SINK, TENANT_DB, TENANT_IAM_CONFIG, TENANT_STORE } from "./tokens.js";

export interface TenantSeedScope {
  store: TenantStore;
  db: TenantDb;
}

export type TenantSeed = (scope: TenantSeedScope) => Promise<void>;

export interface TenantIamRegisterOptions {
  auth: AuthGuardOptions;
  /** Replaces the sink named in the config. */
  auditSink?: AuditSink;
  seed?: TenantSeed;
}

@Injectable()
export class TenantIamBootstrap implements OnModuleInit {
  constructor(
    @Inject(TENANT_DB) private readonly db: TenantDb,
    @Inject(TENANT_STORE) private readonly store: TenantStore,
    @Inject("TENANT_IAM_SEED") private readonly seed: TenantSeed | null,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.db.provision();
    if (this.seed) await this.seed({ store: this.store, db: this.db });
  }
}

@Module({})
export class TenantIamModule {
  static register(config: TenantIamConfig, options: TenantIamRegisterOptions): DynamicModule {
    return {
      module: TenantIamModule,
      imports: [AuthRbacModule.register(options.auth)],
      providers: [
        { provide: TENANT_IAM_CONFIG, useValue: config },
        { provide: "TENANT_IAM_SEED", useValue: options.seed ?? null },
        {
          provide: TENANT_DB,
          useFactory: () => new TenantDb(config),
        },
        {
          provide: AUDIT_SINK,
          useFactory: () => options.auditSink ?? createSink(config),
        },
        {
          provide: TENANT_STORE,
          useFactory: (db: TenantDb, sink: AuditSink) => new TenantStore(db, config, sink),
          inject: [TENANT_DB, AUDIT_SINK],
        },
        {
          provide: TenantDb,
          useExisting: TENANT_DB,
        },
        {
          provide: TenantStore,
          useExisting: TENANT_STORE,
        },
        TenantGuard,
        PermissionsGuard,
        TenantIamBootstrap,
      ],
      exports: [
        AuthRbacModule,
        TENANT_IAM_CONFIG,
        TENANT_DB,
        TENANT_STORE,
        AUDIT_SINK,
        TenantDb,
        TenantStore,
        TenantGuard,
        PermissionsGuard,
      ],
    };
  }
}

function createSink(config: TenantIamConfig): AuditSink {
  if (config.audit.sink === "memory") return new MemoryAuditSink();
  return new PostgresAuditSink(config);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#src/nest/tenant-iam.module.ts";
