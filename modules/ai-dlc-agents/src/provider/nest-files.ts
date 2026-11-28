/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export interface DomainField {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
}

export interface DomainModel {
  entity: string;
  plural: string;
  resource: string;
  fields: DomainField[];
}

export interface WrittenFile {
  path: string;
  contents: string;
}

export function fieldsFor(entity: string): DomainField[] {
  if (entity === "Book") {
    return [
      { name: "id", type: "string", required: true },
      { name: "title", type: "string", required: true },
      { name: "author", type: "string", required: true },
      { name: "year", type: "number", required: false },
    ];
  }
  return [
    { name: "id", type: "string", required: true },
    { name: "name", type: "string", required: true },
    { name: "note", type: "string", required: false },
  ];
}

export function domainFromSubject(subject: { entity: string; plural: string; resource: string }): DomainModel {
  return { ...subject, fields: fieldsFor(subject.entity) };
}

export function buildNestModule(domain: DomainModel): WrittenFile[] {
  const dir = `src/${domain.resource}`;
  return [
    { path: `${dir}/dto.ts`, contents: dtoFile(domain) },
    { path: `${dir}/${domain.resource}.service.ts`, contents: serviceFile(domain) },
    { path: `${dir}/${domain.resource}.controller.ts`, contents: controllerFile(domain) },
    { path: `${dir}/${domain.resource}.module.ts`, contents: moduleFile(domain) },
  ];
}

export function buildServiceTest(domain: DomainModel): WrittenFile {
  return {
    path: `test/${domain.resource}.service.spec.ts`,
    contents: testFile(domain),
  };
}

function dtoFile(domain: DomainModel): string {
  const lines = domain.fields
    .filter((field) => field.name !== "id")
    .map((field) => `  ${field.name}${field.required ? "" : "?"}: ${field.type};`);
  return `export interface Create${domain.entity} {
${lines.join("\n")}
}

export type Update${domain.entity} = Partial<Create${domain.entity}>;
`;
}

function serviceFile(domain: DomainModel): string {
  const record = `${domain.entity}Record`;
  const create = `Create${domain.entity}`;
  const update = `Update${domain.entity}`;
  const fieldLines = domain.fields
    .map((field) => `  ${field.name}${field.required ? "" : "?"}: ${field.type};`)
    .join("\n");
  return `import { Injectable, NotFoundException } from "@nestjs/common";
import type { ${create}, ${update} } from "./dto.js";

export interface ${record} {
${fieldLines}
}

@Injectable()
export class ${domain.plural}Service {
  private readonly rows = new Map<string, ${record}>();

  list(): ${record}[] {
    return [...this.rows.values()];
  }

  get(id: string): ${record} {
    const row = this.rows.get(id);
    if (!row) throw new NotFoundException(id + " was not found.");
    return row;
  }

  create(input: ${create}): ${record} {
    const row = { ...input, id: String(this.rows.size + 1) } as ${record};
    this.rows.set(row.id, row);
    return row;
  }

  update(id: string, input: ${update}): ${record} {
    const next = { ...this.get(id), ...input, id };
    this.rows.set(id, next);
    return next;
  }

  remove(id: string): void {
    this.get(id);
    this.rows.delete(id);
  }
}
`;
}

function controllerFile(domain: DomainModel): string {
  const record = `${domain.entity}Record`;
  const create = `Create${domain.entity}`;
  const update = `Update${domain.entity}`;
  return `import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import type { ${create}, ${update} } from "./dto.js";
import { ${domain.plural}Service, type ${record} } from "./${domain.resource}.service.js";

@Controller("${domain.resource}")
export class ${domain.plural}Controller {
  constructor(private readonly ${camel(domain.resource)}: ${domain.plural}Service) {}

  @Get()
  list(): ${record}[] {
    return this.${camel(domain.resource)}.list();
  }

  @Get(":id")
  get(@Param("id") id: string): ${record} {
    return this.${camel(domain.resource)}.get(id);
  }

  @Post()
  create(@Body() body: ${create}): ${record} {
    return this.${camel(domain.resource)}.create(body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: ${update}): ${record} {
    return this.${camel(domain.resource)}.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string): void {
    this.${camel(domain.resource)}.remove(id);
  }
}
`;
}

function moduleFile(domain: DomainModel): string {
  return `import { Module } from "@nestjs/common";
import { ${domain.plural}Controller } from "./${domain.resource}.controller.js";
import { ${domain.plural}Service } from "./${domain.resource}.service.js";

@Module({
  controllers: [${domain.plural}Controller],
  providers: [${domain.plural}Service],
})
export class ${domain.plural}Module {}
`;
}

function testFile(domain: DomainModel): string {
  const required = domain.fields.filter((field) => field.required && field.name !== "id");
  const input = required
    .map((field) => `${field.name}: ${field.type === "number" ? "1" : `"Example"`}`)
    .join(", ");
  const first = required[0]?.name ?? "id";
  return `import { describe, expect, it } from "vitest";
import { ${domain.plural}Service } from "../src/${domain.resource}/${domain.resource}.service.js";

describe("${domain.plural}Service", () => {
  it("creates and reads a record", () => {
    const service = new ${domain.plural}Service();
    const created = service.create({ ${input} });
    expect(service.get(created.id).${first}).toBe(created.${first});
    expect(service.list()).toHaveLength(1);
  });
});
`;
}

function camel(resource: string): string {
  return resource.slice(0, 1).toLowerCase() + resource.slice(1);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "ai-dlc-agents@0.1.0#src/provider/nest-files.ts";
