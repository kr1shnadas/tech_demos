/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { DynamicModule, Module } from "@nestjs/common";
import { AUTH_GUARD_OPTIONS, type AuthGuardOptions } from "./constants.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { RolesGuard } from "./roles.guard.js";

@Module({})
export class AuthRbacModule {
  static register(options: AuthGuardOptions): DynamicModule {
    return {
      module: AuthRbacModule,
      providers: [
        { provide: AUTH_GUARD_OPTIONS, useValue: options },
        JwtAuthGuard,
        RolesGuard,
      ],
      exports: [AUTH_GUARD_OPTIONS, JwtAuthGuard, RolesGuard],
    };
  }
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#src/nest/auth-rbac.module.ts";
