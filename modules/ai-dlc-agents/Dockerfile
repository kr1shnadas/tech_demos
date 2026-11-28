# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 Krishna Das
# See NOTICE at the repository root.

FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json ./
RUN pnpm install
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY demo ./demo
COPY examples ./examples
RUN pnpm build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DLC_PROVIDER=mock
ENV DLC_PROFILE=startup
ENV DLC_CONFIG=examples/nestjs-crud.yaml
ENV DLC_OUTPUT_ROOT=output
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json ./
RUN pnpm install --prod
COPY --from=build /app/dist ./dist
COPY examples ./examples
RUN mkdir -p /app/output && chown -R node:node /app/output
EXPOSE 3000
USER node
CMD ["node", "dist/demo/api/main.js"]
