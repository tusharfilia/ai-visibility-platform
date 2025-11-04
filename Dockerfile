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

# Copy node_modules to apps/api for proper module resolution
# Node.js resolves modules starting from the file's directory (/app/apps/api/dist/main.js)
# It walks up: dist/node_modules -> api/node_modules -> /app/node_modules
# We need an actual copy (not symlink) at /app/apps/api/node_modules for reliable resolution
RUN mkdir -p /app/apps/api && \
    echo "DEBUG: Checking source node_modules structure..." && \
    ls -la /app/node_modules/ | head -20 && \
    echo "DEBUG: Checking if @nestjs exists in source..." && \
    test -d /app/node_modules/@nestjs && echo "Found @nestjs in source" || echo "WARNING: @nestjs not in source" && \
    echo "DEBUG: Copying node_modules..." && \
    cp -r /app/node_modules /app/apps/api/node_modules && \
    echo "DEBUG: Copy completed, checking destination..." && \
    ls -la /app/apps/api/node_modules/ | head -20 && \
    echo "DEBUG: Verifying @nestjs in destination..." && \
    test -d /app/apps/api/node_modules/@nestjs && echo "Found @nestjs in destination" || echo "ERROR: @nestjs not in destination" && \
    echo "DEBUG: Verifying @nestjs/core package.json..." && \
    test -f /app/apps/api/node_modules/@nestjs/core/package.json && echo "SUCCESS: @nestjs/core package.json found" || echo "ERROR: @nestjs/core package.json not found"

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
  echo 'Checking source node_modules structure:' && \
  ls -la /app/node_modules/@nestjs 2>/dev/null | head -5 || echo 'WARNING: /app/node_modules/@nestjs not found' && \
  echo 'Checking destination node_modules structure:' && \
  ls -la /app/apps/api/node_modules/@nestjs 2>/dev/null | head -5 || echo 'WARNING: /app/apps/api/node_modules/@nestjs not found' && \
  echo 'Checking if node_modules directory exists:' && \
  test -d /app/apps/api/node_modules && echo 'SUCCESS: node_modules directory exists' || echo 'ERROR: node_modules directory missing' && \
  echo 'Verifying @nestjs/core module exists:' && \
  test -f /app/apps/api/node_modules/@nestjs/core/package.json && echo 'SUCCESS: @nestjs/core found' || (echo 'ERROR: @nestjs/core not found' && echo 'Full node_modules listing:' && ls -la /app/apps/api/node_modules/ 2>/dev/null | head -30) && \
  echo 'Starting application...' && \
  node apps/api/dist/main.js"]

