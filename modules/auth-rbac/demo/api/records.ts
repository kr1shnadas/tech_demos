/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

export interface StudyView {
  protocol: string;
  title: string;
  status: string;
  actor: string;
  subjects: { id: string; site: string; visit: string; state: string }[];
}

export interface AuditView {
  title: string;
  actor: string;
  entries: { id: string; site: string; note: string }[];
}

export function studyView(actor: string): StudyView {
  return {
    protocol: "AT-204",
    title: "Antares topical, Phase II",
    status: "Enrollment open",
    actor,
    subjects: [
      { id: "014", site: "Austin", visit: "Week 4", state: "Complete" },
      { id: "015", site: "Austin", visit: "Week 2", state: "Due" },
      { id: "022", site: "Pune", visit: "Screening", state: "Open" },
    ],
  };
}

export function auditView(actor: string): AuditView {
  return {
    title: "Monitoring visit log",
    actor,
    entries: [
      { id: "MV-118", site: "Austin", note: "Source data verified for subjects 014 and 015." },
      { id: "MV-121", site: "Pune", note: "Temperature excursion closed and filed." },
    ],
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

export const buildFingerprint = "auth-rbac@0.1.0#demo/api/records.ts";
