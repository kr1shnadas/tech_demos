/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  bearerToken,
  verifyAccessToken,
  type AuthGuardOptions,
  type AuthUser,
  AUTH_GUARD_OPTIONS,
} from "@krishnadas/auth-rbac";
import type { TenantIamConfig } from "../config/tenant-config.js";
import { TenantStore } from "../store/tenant-store.js";
import { TenantResolutionError, resolveTenantId } from "../tenant/resolve.js";
import { TENANT_IAM_CONFIG } from "./tokens.js";

export interface TenantAccess {
  id: string;
  name: string;
  role: string;
  permissions: string[];
  user: AuthUser;
}

interface GuardRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
  tenantAccess?: TenantAccess;
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    @Inject(TENANT_IAM_CONFIG) private readonly config: TenantIamConfig,
    @Inject(AUTH_GUARD_OPTIONS) private readonly auth: AuthGuardOptions,
    @Inject(TenantStore) private readonly store: TenantStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardRequest>();
    if (!request.user) {
      throw new UnauthorizedException("Sign-in required.");
    }

    const token = bearerToken(request.headers.authorization);
    if (this.config.resolution.source === "jwt") {
      if (!token) throw new UnauthorizedException("Missing bearer token.");
      try {
        await verifyAccessToken(token, this.auth.config, { localJwks: this.auth.localJwks });
      } catch {
        throw new UnauthorizedException("Token was rejected.");
      }
    }

    let tenantId: string;
    try {
      tenantId = resolveTenantId(this.config, {
        token,
        header: headerValue(request.headers, this.config.resolution.headerName),
        host: request.headers.host,
      });
    } catch (error) {
      if (error instanceof TenantResolutionError) {
        if (error.status === 401) throw new UnauthorizedException(error.message);
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const tenant = await this.store.getTenant(tenantId);
    if (!tenant) throw new NotFoundException("Unknown tenant.");

    const membership = await this.store.findMembership(tenantId, request.user.sub);
    if (!membership) throw new ForbiddenException("No membership in this tenant.");

    request.tenantAccess = {
      id: tenant.id,
      name: tenant.name,
      role: membership.roleName,
      permissions: membership.permissions,
      user: request.user,
    };
    return true;
  }
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | string[] | undefined {
  const direct = headers[name];
  if (direct !== undefined) return direct;
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match?.[1];
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#src/nest/tenant.guard.ts";
