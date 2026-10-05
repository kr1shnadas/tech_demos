/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { inject, provideAppInitializer } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { AppComponent } from "./app/app.component.js";
import { routes } from "./app/app.routes.js";
import { SessionStore } from "./app/session.service.js";

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAppInitializer(() => inject(SessionStore).bootstrap()),
  ],
}).catch((error: unknown) => {
  console.error(error);
});

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#demo/angular/src/main.ts";
