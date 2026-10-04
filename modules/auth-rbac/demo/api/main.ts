/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule);
app.enableCors({
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4200",
    "http://127.0.0.1:4200",
  ],
  allowedHeaders: ["authorization", "content-type"],
  methods: ["GET", "POST", "OPTIONS"],
});

const port = Number(process.env.API_PORT ?? 4000);
await app.listen(port);
console.log(`Study API at http://localhost:${port}`);

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#demo/api/main.ts";
