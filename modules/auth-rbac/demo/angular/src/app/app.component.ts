/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { Component, inject } from "@angular/core";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { authorCredit as credit, buildFingerprint as fingerprint } from "../../../../src/credit.js";
import { SessionStore } from "./session.service.js";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="page">
      <header class="top">
        <div>
          <p class="eyebrow">Authentication and role-based access</p>
          <h1 class="brand">Study access</h1>
        </div>
        <div class="shell-label">Angular</div>
      </header>
      <div class="layout">
        <aside class="nav">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
          <a routerLink="/study" routerLinkActive="active">Study workspace</a>
          <a routerLink="/audit" routerLinkActive="active">Audit review</a>
          @if (session.user()) {
            <button class="ghost" type="button" (click)="signOut()">Sign out</button>
          }
        </aside>
        <main>
          <router-outlet />
        </main>
      </div>
      <footer>
        <p>{{ credit.name }} · {{ credit.copyright }} · {{ credit.license }}</p>
        <p>{{ credit.notice }}</p>
        <p class="fingerprint">{{ fingerprint }}</p>
      </footer>
    </div>
  `,
})
export class AppComponent {
  readonly session = inject(SessionStore);
  readonly credit = credit;
  readonly fingerprint = fingerprint;
  private readonly router = inject(Router);

  signOut(): void {
    this.session.signOut();
    void this.router.navigateByUrl("/");
  }
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#demo/angular/src/app/app.component.ts";
