/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export interface DemoMembership {
  tenantId: string;
  tenantName: string;
  role: string;
}

export interface DemoPerson {
  sub: string;
  name: string;
  email: string;
  memberships: DemoMembership[];
}

export interface DemoRecord {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
}

export const demoPeople: DemoPerson[] = [
  {
    sub: "meera",
    name: "Meera Shah",
    email: "meera.shah@northwind.example",
    memberships: [
      { tenantId: "northwind", tenantName: "Northwind Labs", role: "owner" },
      { tenantId: "harbor", tenantName: "Harbor Clinic", role: "reader" },
    ],
  },
  {
    sub: "owen",
    name: "Owen Blake",
    email: "owen.blake@harbor.example",
    memberships: [{ tenantId: "harbor", tenantName: "Harbor Clinic", role: "member" }],
  },
  {
    sub: "krishna",
    name: "Krishna Das",
    email: "krishna.das@example.com",
    memberships: [
      { tenantId: "northwind", tenantName: "Northwind Labs", role: "owner" },
      { tenantId: "harbor", tenantName: "Harbor Clinic", role: "owner" },
    ],
  },
];

export const demoRecords: DemoRecord[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    tenantId: "northwind",
    title: "NW-14 amendment 3",
    body: "Eligibility age lowered to 18. Sites were told on Monday.",
    createdBy: "meera",
    createdAt: "2026-03-02T14:10:00.000Z",
  },
  {
    id: "11111111-1111-4111-8111-111111111112",
    tenantId: "northwind",
    title: "Closeout checklist",
    body: "Pharmacy return is still open for site 12.",
    createdBy: "krishna",
    createdAt: "2026-03-18T09:40:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222221",
    tenantId: "harbor",
    title: "Screening log",
    body: "Four subjects screened this week. Two enrolled.",
    createdBy: "owen",
    createdAt: "2026-03-04T11:05:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    tenantId: "harbor",
    title: "Temperature excursion",
    body: "Pharmacy fridge reached 9 C for twenty minutes. The lot is quarantined.",
    createdBy: "owen",
    createdAt: "2026-03-21T16:25:00.000Z",
  },
];

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "multi-tenant-iam@0.1.0#demo/api/directory.ts";
