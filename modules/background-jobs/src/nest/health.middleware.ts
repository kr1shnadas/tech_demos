/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import type { JobsConfig } from "../config/jobs-config.js";
import { readiness } from "../health/health.js";
import type { JobRuntime } from "../queue/runtime.js";
import { JOBS_CONFIG, JOBS_RUNTIME } from "./tokens.js";

@Injectable()
export class HealthMiddleware implements NestMiddleware {
  constructor(
    @Inject(JOBS_CONFIG) private readonly config: JobsConfig,
    @Inject(JOBS_RUNTIME) private readonly runtime: JobRuntime,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.path === this.config.health.livenessPath) {
      res.status(200).json({ status: "ok" });
      return;
    }
    if (req.path === this.config.health.readinessPath) {
      const report = await readiness(() => this.runtime.ping());
      res.status(report.status === "ok" ? 200 : 503).json(report);
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

export const buildFingerprint = "background-jobs@0.1.0#src/nest/health.middleware.ts";
