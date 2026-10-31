/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { observabilityConfig, tracing } from "./instrument.js";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { OBSERVABILITY_LOGGER, type AppLogger } from "../../src/index.js";
import { AppModule } from "./app.module.js";

const config = observabilityConfig;
const port = readPort(process.env.PORT ?? "3001");

const app = await NestFactory.create(AppModule.register(config), { logger: false });
app.enableShutdownHooks();
await app.listen(port, "0.0.0.0");
const logger = app.get<AppLogger>(OBSERVABILITY_LOGGER);
logger.info({ port }, "listening");

let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await app.close();
  await tracing.shutdown();
};
process.once("SIGTERM", () => {
  void close();
});
process.once("SIGINT", () => {
  void close();
});

function readPort(raw: string): number {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535.");
  }
  return port;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#demo/catalog/main.ts";
