/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { KafkaContainer, type StartedKafkaContainer } from "@testcontainers/kafka";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { PostgresSettings } from "../../src/config/kafka-config.js";

export interface Infra {
  brokers: string[];
  postgres: PostgresSettings;
  stop: () => Promise<void>;
}

const KAFKA_PLAINTEXT_PORT = 9093;

export async function startInfra(): Promise<Infra> {
  const postgres: StartedPostgreSqlContainer = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("events")
    .withUsername("events")
    .withPassword("events")
    .start();
  const kafka: StartedKafkaContainer = await new KafkaContainer("confluentinc/cp-kafka:7.7.1").withKraft().start();
  return {
    brokers: [`${kafka.getHost()}:${kafka.getMappedPort(KAFKA_PLAINTEXT_PORT)}`],
    postgres: {
      host: postgres.getHost(),
      port: postgres.getPort(),
      user: postgres.getUsername(),
      password: postgres.getPassword(),
      database: postgres.getDatabase(),
    },
    stop: async () => {
      await kafka.stop();
      await postgres.stop();
    },
  };
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "kafka-event-stream@0.1.0#test/support/infra.ts";
