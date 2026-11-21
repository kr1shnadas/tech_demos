/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { createParamDecorator, SetMetadata, type ExecutionContext } from "@nestjs/common";
import type { TenantAccess } from "./tenant.guard.js";
import { PERMISSIONS_KEY } from "./tokens.js";

/** Every listed permission is required. */
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantAccess | undefined => {
    const request = ctx.switchToHttp().getRequest<{ tenantAccess?: TenantAccess }>();
    return request.tenantAccess;
  },
);

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#src/nest/decorators.ts";
