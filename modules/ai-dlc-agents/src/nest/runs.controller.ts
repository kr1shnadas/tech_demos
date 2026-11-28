/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import {
  ApprovalError,
  ConfigError,
  RequestError,
  RunNotFoundError,
} from "../runtime/errors.js";
import type { WorkflowOrchestrator, WorkflowRun } from "../runtime/orchestrator.js";
import type { AuditEntry } from "../runtime/audit-log.js";
import { ORCHESTRATOR } from "./tokens.js";

@Controller("api")
export class RunsController {
  constructor(@Inject(ORCHESTRATOR) private readonly orchestrator: WorkflowOrchestrator) {}

  @Post("runs")
  @HttpCode(201)
  async start(@Body() body: unknown): Promise<WorkflowRun> {
    const input = readStart(body);
    try {
      return await this.orchestrator.start(input);
    } catch (error) {
      rethrow(error);
    }
  }

  @Get("runs")
  list(): WorkflowRun[] {
    return this.orchestrator.list();
  }

  @Get("runs/:id")
  get(@Param("id") id: string): WorkflowRun {
    try {
      return this.orchestrator.get(id);
    } catch (error) {
      rethrow(error);
    }
  }

  @Post("runs/:id/approvals")
  @HttpCode(200)
  async decide(@Param("id") id: string, @Body() body: unknown): Promise<WorkflowRun> {
    const input = readDecision(body);
    try {
      if (input.decision === "reject") return await this.orchestrator.reject(id, input.actor, input.comment);
      return await this.orchestrator.approve(id, input.actor, input.comment);
    } catch (error) {
      rethrow(error);
    }
  }

  @Get("audit")
  audit(): readonly AuditEntry[] {
    return this.orchestrator.audit();
  }
}

function readStart(body: unknown): { workflow: string; intent: string; actor: string; profile?: string } {
  const record = objectBody(body);
  const workflow = readString(record.workflow, "workflow");
  const intent = readString(record.intent, "intent");
  const actor = typeof record.actor === "string" && record.actor.trim() ? record.actor.trim() : "operator";
  const profile = typeof record.profile === "string" && record.profile.trim() ? record.profile.trim() : undefined;
  return profile ? { workflow, intent, actor, profile } : { workflow, intent, actor };
}

function readDecision(body: unknown): { actor: string; decision: "approve" | "reject"; comment?: string } {
  const record = objectBody(body);
  const actor = readString(record.actor, "actor");
  const decision = readString(record.decision, "decision");
  if (decision !== "approve" && decision !== "reject") {
    throw new BadRequestException("decision must be approve or reject.");
  }
  const comment = typeof record.comment === "string" ? record.comment : undefined;
  return comment === undefined ? { actor, decision } : { actor, decision, comment };
}

function objectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestException("body must be an object.");
  }
  return body as Record<string, unknown>;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${label} is required.`);
  }
  return value.trim();
}

function rethrow(error: unknown): never {
  if (error instanceof RunNotFoundError) throw new NotFoundException(error.message);
  if (error instanceof ApprovalError) throw new ConflictException(error.message);
  if (error instanceof RequestError || error instanceof ConfigError) throw new BadRequestException(error.message);
  throw error;
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/nest/runs.controller.ts";
