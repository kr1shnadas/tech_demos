/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { Module } from "@nestjs/common";
import { loadAuthConfig } from "../../src/config/load-config.js";
import { AuthRbacModule } from "../../src/nest/auth-rbac.module.js";
import { StudyController } from "./study.controller.js";

@Module({
  imports: [AuthRbacModule.register({ config: loadAuthConfig() })],
  controllers: [StudyController],
})
export class AppModule {}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#demo/api/app.module.ts";
