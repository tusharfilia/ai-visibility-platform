# Multi-stage build for AI Visibility Platform API
FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/jobs/package.json ./apps/jobs/
# Copy all package.json files from packages (using explicit paths for better reliability)
COPY packages/automation/package.json ./packages/automation/
COPY packages/content/package.json ./packages/content/
COPY packages/copilot/package.json ./packages/copilot/
COPY packages/db/package.json ./packages/db/
COPY packages/geo/package.json ./packages/geo/
COPY packages/optimizer/package.json ./packages/optimizer/
COPY packages/parser/package.json ./packages/parser/
COPY packages/prompts/package.json ./packages/prompts/
COPY packages/providers/package.json ./packages/providers/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (without frozen-lockfile since we don't have one yet)
FROM base AS deps
RUN pnpm install --no-frozen-lockfile

# Copy source code
FROM deps AS build
COPY . .

# Build all packages
RUN pnpm build

# Production image
FROM base AS production

# Copy built artifacts and node_modules
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages ./packages

WORKDIR /app/apps/api

# Expose port
EXPOSE 8080

# Start the API
CMD ["node", "dist/main.js"]

