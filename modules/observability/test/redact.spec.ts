/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { describe, expect, it } from "vitest";
import { redactFieldSet, redactValue, redacted } from "../src/logging/redact.js";

const fields = redactFieldSet(["password", "authorization", "token"]);

describe("redaction", () => {
  it("replaces a configured field and keeps the rest", () => {
    const cleaned = redactValue({ password: "hunter2", user: "ada" }, fields);
    expect(cleaned).toEqual({ password: redacted, user: "ada" });
  });

  it("walks nested objects and arrays, ignoring case", () => {
    const cleaned = redactValue(
      {
        user: { Token: "abc", id: 7 },
        headers: [{ authorization: "Bearer xyz" }, { accept: "application/json" }],
      },
      fields,
    );
    expect(cleaned).toEqual({
      user: { Token: redacted, id: 7 },
      headers: [{ authorization: redacted }, { accept: "application/json" }],
    });
  });

  it("does not change the input", () => {
    const input = { password: "hunter2" };
    redactValue(input, fields);
    expect(input.password).toBe("hunter2");
  });
});

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "observability@0.1.0#test/redact.spec.ts";
