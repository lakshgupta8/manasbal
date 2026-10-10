# syntax=docker/dockerfile:1
# Built from the repository root: docker build -f apps/api/Dockerfile .

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @manasbal/api...
RUN pnpm --filter @manasbal/api build \
 && pnpm --filter @manasbal/api deploy --prod --legacy /out

FROM node:24-alpine AS runtime
# The API only needs `node`. Package managers bundled with the base image are attack
# surface (and the source of most scanner findings), so they're removed.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
      /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
ARG APP_VERSION=dev
ENV NODE_ENV=production PORT=3000 APP_VERSION=$APP_VERSION
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/main.js"]
