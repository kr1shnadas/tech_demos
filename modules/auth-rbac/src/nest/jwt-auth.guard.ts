/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import "reflect-metadata";
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { AuthUser } from "../access/evaluate-access.js";
import { verifyAccessToken } from "../jwt/verify-token.js";
import { AUTH_GUARD_OPTIONS, type AuthGuardOptions } from "./constants.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(AUTH_GUARD_OPTIONS) private readonly options: AuthGuardOptions) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string | string[] };
      user?: AuthUser;
    }>();
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }
    try {
      request.user = await verifyAccessToken(token, this.options.config, {
        localJwks: this.options.localJwks,
      });
    } catch {
      throw new UnauthorizedException("Token was rejected.");
    }
    return true;
  }
}

export function bearerToken(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(value.trim());
  return match?.[1];
}

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#src/nest/jwt-auth.guard.ts";
