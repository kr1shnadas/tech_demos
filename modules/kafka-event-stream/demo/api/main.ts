/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadKafkaConfig } from "../../src/config/load-config.js";
import { AppModule } from "./app.module.js";
import { mountStatusPage } from "./static-page.js";

const config = loadKafkaConfig();
const portValue = process.env.PORT ?? "3000";
const port = Number(portValue);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer from 1 to 65535.");
}

const app = await NestFactory.create(AppModule.register(config), { logger: ["error", "warn"] });
app.enableShutdownHooks();
mountStatusPage(app);
await app.listen(port, "0.0.0.0");
console.log(`kafka-event-stream listening on http://localhost:${port}`);

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#demo/api/main.ts";
