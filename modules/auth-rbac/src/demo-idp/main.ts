/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Krishna Das
 *
 * See NOTICE at the repository root.
 */

import { createDemoIdentityProvider } from "./server.js";

const port = Number(process.env.IDP_PORT ?? 4100);
const issuer = process.env.IDP_ISSUER ?? `http://localhost:${port}`;
const idp = await createDemoIdentityProvider({ issuer });

idp.server.listen(port, () => {
  console.log(`Demo identity provider at ${idp.issuer}`);
});

export const authorCredit = {
  name: "Krishna Das",
  email: "7599778+kr1shnadas@users.noreply.github.com",
  copyright: "Copyright 2026 Krishna Das",
  license: "Apache-2.0" as const,
  notice: "See NOTICE at the repository root.",
  profile: "https://github.com/kr1shnadas",
};

export const buildFingerprint = "auth-rbac@0.1.0#src/demo-idp/main.ts";
