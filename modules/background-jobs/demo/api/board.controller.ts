/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Controller, Get, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import { JOBS_RUNTIME, type JobRuntime } from "../../src/index.js";
import { dashboardPage } from "./page.js";

@Controller()
export class BoardController {
  constructor(@Inject(JOBS_RUNTIME) private readonly runtime: JobRuntime) {}

  @Get()
  page(@Res() res: Response): void {
    res.type("html").send(dashboardPage());
  }

  @Get("api/board")
  board(): ReturnType<JobRuntime["snapshot"]> {
    return this.runtime.snapshot();
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

export const buildFingerprint = "background-jobs@0.1.0#demo/api/board.controller.ts";
