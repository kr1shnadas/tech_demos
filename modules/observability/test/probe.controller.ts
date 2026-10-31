/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Controller, Get, Inject } from "@nestjs/common";
import type { AppLogger } from "../src/logging/logger.js";
import { OBSERVABILITY_LOGGER } from "../src/nest/tokens.js";

@Controller("api")
export class ProbeController {
  constructor(@Inject(OBSERVABILITY_LOGGER) private readonly logger: AppLogger) {}

  @Get("ping")
  ping(): { ok: boolean } {
    this.logger.info({ password: "secret", note: "hello" }, "ping");
    return { ok: true };
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

export const buildFingerprint = "observability@0.1.0#test/probe.controller.ts";
