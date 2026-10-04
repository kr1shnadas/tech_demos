/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export interface DemoUser {
  username: string;
  password: string;
  name: string;
  email: string;
  roles: string[];
  summary: string;
}

export const demoUsers: readonly DemoUser[] = [
  {
    username: "clinician",
    password: "clinician",
    name: "Meera Shah",
    email: "meera.shah@demo.local",
    roles: ["clinician"],
    summary: "Study workspace",
  },
  {
    username: "auditor",
    password: "auditor",
    name: "Owen Blake",
    email: "owen.blake@demo.local",
    roles: ["auditor"],
    summary: "Audit review",
  },
  {
    username: "admin",
    password: "admin",
    name: "Krishna Das",
    email: "krishna.das@demo.local",
    roles: ["admin", "clinician", "auditor"],
    summary: "Study workspace and audit review",
  },
];

export function findDemoUser(username: string, password: string): DemoUser | undefined {
  return demoUsers.find((user) => user.username === username && user.password === password);
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#src/demo-idp/users.ts";
