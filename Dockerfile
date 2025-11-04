# Multi-stage build for AI Visibility Platform API
FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/jobs/package.json ./apps/jobs/

# Copy all package.json files from packages directory
# Create all package directories first
RUN mkdir -p packages/automation packages/content packages/copilot packages/db \
    packages/geo packages/optimizer packages/parser packages/prompts \
    packages/providers packages/shared

# Copy package.json files individually (wildcard not reliable in Docker)
COPY packages/automation/package.json ./packages/automation/package.json
COPY packages/content/package.json ./packages/content/package.json
COPY packages/copilot/package.json ./packages/copilot/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/geo/package.json ./packages/geo/package.json
COPY packages/optimizer/package.json ./packages/optimizer/package.json
COPY packages/parser/package.json ./packages/parser/package.json
COPY packages/prompts/package.json ./packages/prompts/package.json
COPY packages/providers/package.json ./packages/providers/package.json
COPY packages/shared/package.json ./packages/shared/package.json

# Install dependencies (without frozen-lockfile since we don't have one yet)
FROM base AS deps
# Skip Puppeteer Chrome download during build to speed up installation
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
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

# Create symlink AND copy node_modules to apps/api for maximum compatibility
# Some Node.js versions don't follow symlinks properly for module resolution
RUN mkdir -p /app/apps/api && \
    ln -sf /app/node_modules /app/apps/api/node_modules && \
    # Also ensure @nestjs is accessible (verify it exists)
    test -d /app/node_modules/@nestjs || (echo "ERROR: @nestjs not found!" && ls -la /app/node_modules/ | head -20)

# Keep WORKDIR at /app for proper module resolution
WORKDIR /app

# Expose port
EXPOSE 8080

# Set NODE_PATH to help resolve modules from root node_modules
# This is a fallback - Node.js should find modules via normal resolution
ENV NODE_PATH=/app/node_modules

# Start the API - ensure we're in /app and use absolute path
# The cd ensures Node.js resolves modules relative to /app
CMD ["sh", "-c", "cd /app && pwd && ls -la node_modules/@nestjs 2>/dev/null | head -5 || echo 'node_modules check failed' && node apps/api/dist/main.js"]

