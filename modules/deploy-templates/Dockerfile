# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 Krishna Das
# See NOTICE at the repository root.

FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json ./
RUN pnpm install

FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY demo ./demo
RUN pnpm build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json ./
RUN pnpm install --prod
COPY --from=build /app/dist ./dist
# The extension proxies a Lambda invocation to the NestJS port.
# Fargate does not start extensions. The command stays the HTTP server.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 /lambda-adapter /opt/extensions/lambda-adapter
ENV AWS_LWA_PORT=3000
ENV AWS_LWA_READINESS_CHECK_PATH=/health
EXPOSE 3000
USER node
CMD ["node", "dist/demo/api/main.js"]
