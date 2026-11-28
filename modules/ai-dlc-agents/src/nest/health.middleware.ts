/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import type { KitConfig } from "../config/kit-config.js";
import { KIT_CONFIG } from "./tokens.js";

@Injectable()
export class HealthMiddleware implements NestMiddleware {
  constructor(@Inject(KIT_CONFIG) private readonly config: KitConfig) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (req.path === this.config.health.livenessPath || req.path === this.config.health.readinessPath) {
      res.status(200).json({ status: "ok" });
      return;
    }
    next();
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

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/nest/health.middleware.ts";
