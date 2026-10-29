# syntax=docker/dockerfile:1

# The Revive ST server. Build from the repository root, the server depends on
# workspace packages:
#
#   docker build -f apps/api/Dockerfile .

# Bundle the server into `dist/main.mjs`. The output is plain JavaScript, so
# this stage runs on the build platform.
FROM --platform=$BUILDPLATFORM node:26-slim AS build
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install --global "$(node --print 'require("./package.json").packageManager')"
COPY patches patches
COPY apps/api/package.json apps/api/
COPY packages/bose-api-speaker-client/package.json packages/bose-api-speaker-client/
# `--ignore-scripts`: the root `prepare` script installs git hooks.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @revive-st/api...
COPY tsconfig.json ./
COPY apps/api apps/api
COPY packages/bose-api-speaker-client packages/bose-api-speaker-client
RUN pnpm --filter @revive-st/api bundle

# Production dependencies, installed on the target platform: `@libsql/*` ships
# native binaries per platform.
FROM node:26-slim AS deps
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install --global "$(node --print 'require("./package.json").packageManager')"
COPY patches patches
COPY apps/api/package.json apps/api/
COPY packages/bose-api-speaker-client/package.json packages/bose-api-speaker-client/
RUN pnpm --filter @revive-st/api deploy --prod /prod

FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/data/revivest.db
COPY --from=deps /prod/node_modules node_modules
COPY apps/api/drizzle drizzle
COPY apps/api/public public
COPY --from=build /repo/apps/api/dist dist
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "dist/main.mjs"]
