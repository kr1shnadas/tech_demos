/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { Controller, Get, Inject } from "@nestjs/common";
import { UseGuards } from "@nestjs/common";
import type { AuthUser } from "../../src/access/evaluate-access.js";
import { toPublicAuthConfig } from "../../src/config/auth-config.js";
import { AUTH_GUARD_OPTIONS, type AuthGuardOptions } from "../../src/nest/constants.js";
import { CurrentUser, Roles } from "../../src/nest/decorators.js";
import { JwtAuthGuard } from "../../src/nest/jwt-auth.guard.js";
import { RolesGuard } from "../../src/nest/roles.guard.js";
import { auditView, studyView } from "./records.js";

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#demo/api/study.controller.ts";

@Controller("api")
export class StudyController {
  constructor(@Inject(AUTH_GUARD_OPTIONS) private readonly options: AuthGuardOptions) {}

  @Get("health")
  health() {
    return { status: "ok", fingerprint: buildFingerprint, author: authorCredit.name };
  }

  @Get("config")
  config() {
    return toPublicAuthConfig(this.options.config);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return { user, fingerprint: buildFingerprint };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("clinician", "admin")
  @Get("study")
  study(@CurrentUser() user: AuthUser) {
    return studyView(user.name);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("auditor", "admin")
  @Get("audit")
  audit(@CurrentUser() user: AuthUser) {
    return auditView(user.name);
  }
}
