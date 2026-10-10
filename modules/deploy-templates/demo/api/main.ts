/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadDeployConfig } from "../../src/config/load-config.js";
import { AppModule } from "./app.module.js";

const config = loadDeployConfig();
const portValue = process.env.PORT ?? String(config.containerPort);
const port = Number(portValue);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer from 1 to 65535.");
}

const app = await NestFactory.create(AppModule.register(config));
await app.listen(port, "0.0.0.0");
console.log(`${config.serviceName} listening on http://localhost:${port}`);

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "deploy-templates@0.1.0#demo/api/main.ts";
