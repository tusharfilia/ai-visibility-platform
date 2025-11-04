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

# Create proper symlink for node_modules resolution
# Node.js resolves modules starting from the file's directory (/app/apps/api/dist/main.js)
# It walks up: dist/node_modules -> api/node_modules -> /app/node_modules
# We need node_modules at /app/apps/api/node_modules pointing to /app/node_modules
RUN mkdir -p /app/apps/api && \
    rm -rf /app/apps/api/node_modules && \
    ln -s /app/node_modules /app/apps/api/node_modules && \
    # Verify symlink and @nestjs exists
    test -L /app/apps/api/node_modules && \
    test -d /app/node_modules/@nestjs && \
    test -d /app/apps/api/node_modules/@nestjs && \
    echo "SUCCESS: Symlink created and @nestjs found" || \
    (echo "ERROR: Symlink verification failed!" && \
     ls -la /app/apps/api/ && \
     ls -la /app/node_modules/ | head -10)

# Keep WORKDIR at /app for proper module resolution
WORKDIR /app

# Expose port
EXPOSE 8080

# Set NODE_PATH to help resolve modules from root node_modules
# This is a fallback - Node.js should find modules via normal resolution
ENV NODE_PATH=/app/node_modules

# Start the API - ensure we're in /app and verify module resolution
CMD ["sh", "-c", "cd /app && \
  echo 'Working directory:' && pwd && \
  echo 'Checking node_modules locations:' && \
  ls -la /app/node_modules/@nestjs 2>/dev/null | head -3 || echo 'WARNING: /app/node_modules/@nestjs not found' && \
  ls -la /app/apps/api/node_modules/@nestjs 2>/dev/null | head -3 || echo 'WARNING: /app/apps/api/node_modules/@nestjs not found' && \
  echo 'Checking symlink:' && \
  ls -la /app/apps/api/node_modules 2>/dev/null | head -1 || echo 'WARNING: symlink check failed' && \
  echo 'Starting application...' && \
  node apps/api/dist/main.js"]

