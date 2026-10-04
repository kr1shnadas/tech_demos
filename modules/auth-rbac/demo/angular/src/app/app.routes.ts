/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { inject } from "@angular/core";
import { type CanActivateFn, type Routes } from "@angular/router";
import { requireRoles } from "../../../../src/angular/role.guard.js";
import { AuditPage, CallbackPage, DeniedPage, HomePage, StudyPage } from "./pages.js";
import { SessionStore } from "./session.service.js";

export const routes: Routes = [
  { path: "", component: HomePage },
  { path: "callback", component: CallbackPage },
  { path: "study", component: StudyPage, canActivate: [guardFor(["clinician", "admin"])] },
  { path: "audit", component: AuditPage, canActivate: [guardFor(["auditor", "admin"])] },
  { path: "denied", component: DeniedPage },
  { path: "**", redirectTo: "" },
];

function guardFor(roles: readonly string[]): CanActivateFn {
  return (route, state) => {
    const session = inject(SessionStore);
    return requireRoles(roles, session.config())(route, state);
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

export const buildFingerprint = "auth-rbac@0.1.0#demo/angular/src/app/app.routes.ts";
