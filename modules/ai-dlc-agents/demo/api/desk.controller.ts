/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Controller, Get, Header } from "@nestjs/common";
import { deskPage } from "./page.js";

@Controller()
export class DeskController {
  @Get()
  @Header("content-type", "text/html; charset=utf-8")
  page(): string {
    return deskPage();
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

export const buildFingerprint = "ai-dlc-agents@0.1.0#demo/api/desk.controller.ts";
