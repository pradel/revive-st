# Stage 1: Build the next.js site
FROM node:24-alpine AS builder
RUN npm install -g pnpm@11.3.0

WORKDIR /app

# Copy package config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/app/package.json ./apps/app/
COPY apps/website/package.json ./apps/website/
COPY packages/bose-api-speaker-client/package.json ./packages/bose-api-speaker-client/
COPY packages/bose-wifi/package.json ./packages/bose-wifi/

# Remove root prepare script to prevent VP command requirement during build
RUN npm pkg delete scripts.prepare

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Run build
RUN pnpm --filter @revive-st/website build

# Stage 2: Serve using Nginx
FROM nginx:1-alpine
COPY --from=builder /app/apps/website/out /usr/share/nginx/html
