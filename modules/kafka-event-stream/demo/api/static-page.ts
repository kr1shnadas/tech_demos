/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { INestApplication } from "@nestjs/common";
import express from "express";

/** Serves the built status page when `demo/react/dist` is present. */
export function mountStatusPage(app: INestApplication): void {
  const dir = join(process.cwd(), "demo", "react", "dist");
  const index = join(dir, "index.html");
  if (!existsSync(index)) return;
  const server = app.getHttpAdapter().getInstance() as express.Express;
  server.use(express.static(dir, { index: false }));
  server.get(/^\/(?!api(?:\/|$)).*/, (_req, res, next) => {
    res.sendFile(index, (error) => {
      if (error) next();
    });
  });
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#demo/api/static-page.ts";
