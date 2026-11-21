/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, type AuthUser } from "@krishnadas/auth-rbac";
import {
  CurrentTenant,
  PermissionsGuard,
  RequirePermissions,
  TenantError,
  TenantGuard,
  TenantStore,
  toPublicTenantConfig,
  TENANT_IAM_CONFIG,
  type TenantAccess,
  type TenantIamConfig,
} from "../../src/index.js";
import { demoPeople } from "./directory.js";
import { DEMO_ISSUER, signDemoToken, type DemoIssuer } from "./session.js";

interface SessionBody {
  sub?: unknown;
  tenantId?: unknown;
}

interface RecordBody {
  title?: unknown;
  body?: unknown;
}

@Controller("api")
export class AdminController {
  constructor(
    @Inject(TenantStore) private readonly store: TenantStore,
    @Inject(TENANT_IAM_CONFIG) private readonly config: TenantIamConfig,
    @Inject(DEMO_ISSUER) private readonly issuer: DemoIssuer,
  ) {}

  @Get("health")
  async health(): Promise<{ status: string; service: string }> {
    await this.store.ping();
    return { status: "ok", service: "multi-tenant-iam" };
  }

  @Get("config")
  configView() {
    return toPublicTenantConfig(this.config);
  }

  @Get("directory")
  directory() {
    return { people: demoPeople };
  }

  @Post("session")
  @HttpCode(200)
  async session(@Body() body: SessionBody) {
    const sub = readText(body?.sub, "sub");
    const tenantId = readText(body?.tenantId, "tenantId");
    const person = demoPeople.find((item) => item.sub === sub);
    if (!person) throw new NotFoundException("Unknown person.");

    let tenant;
    let membership;
    try {
      tenant = await this.store.getTenant(tenantId);
      membership = tenant ? await this.store.findMembership(tenantId, sub) : null;
    } catch (error) {
      rethrow(error);
    }
    if (!tenant) throw new NotFoundException("Unknown tenant.");
    if (!membership) throw new ForbiddenException("No membership in this tenant.");

    const token = await signDemoToken(this.issuer, {
      sub: person.sub,
      name: person.name,
      email: person.email,
      tenantId: tenant.id,
    });
    return {
      token,
      user: { sub: person.sub, name: person.name, email: person.email },
      tenant: { id: tenant.id, name: tenant.name },
      role: membership.roleName,
      permissions: membership.permissions,
    };
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get("me")
  me(@CurrentUser() user: AuthUser, @CurrentTenant() tenant: TenantAccess) {
    return {
      user: { sub: user.sub, name: user.name, email: user.email },
      tenant: { id: tenant.id, name: tenant.name },
      role: tenant.role,
      permissions: tenant.permissions,
    };
  }

  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions("records.read")
  @Get("records")
  async records(@CurrentTenant() tenant: TenantAccess) {
    try {
      const records = await this.store.listRecords(tenant.id);
      return { tenantId: tenant.id, records };
    } catch (error) {
      rethrow(error);
    }
  }

  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions("records.write")
  @Post("records")
  async createRecord(@CurrentTenant() tenant: TenantAccess, @Body() body: RecordBody) {
    const title = readText(body?.title, "title");
    const note = readText(body?.body, "body");
    try {
      const record = await this.store.createRecord(tenant.id, { title, body: note }, tenant.user.sub);
      return record;
    } catch (error) {
      rethrow(error);
    }
  }

  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions("audit.read")
  @Get("audit")
  async audit(@CurrentTenant() tenant: TenantAccess) {
    try {
      const events = await this.store.listAudit(tenant.id, 50);
      return { tenantId: tenant.id, events };
    } catch (error) {
      rethrow(error);
    }
  }

  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions("members.read")
  @Get("members")
  async members(@CurrentTenant() tenant: TenantAccess) {
    try {
      const members = await this.store.listMembers(tenant.id);
      return { tenantId: tenant.id, members };
    } catch (error) {
      rethrow(error);
    }
  }
}

function readText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${label} is required.`);
  }
  return value.trim();
}

function rethrow(error: unknown): never {
  if (error instanceof TenantError) {
    if (error.status === 404) throw new NotFoundException(error.message);
    throw new BadRequestException(error.message);
  }
  if (
    error instanceof BadRequestException ||
    error instanceof UnauthorizedException ||
    error instanceof ForbiddenException ||
    error instanceof NotFoundException
  ) {
    throw error;
  }
  throw error;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#demo/api/admin.controller.ts";
