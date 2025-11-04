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

# Copy node_modules to apps/api, dereferencing symlinks to copy actual files
# pnpm uses symlinks in node_modules pointing to .pnpm store
# Using -L flag to dereference symlinks and copy actual files instead
RUN sh -c ' \
    mkdir -p /app/apps/api && \
    echo "DEBUG: Copying node_modules structure..." && \
    cp -rL /app/node_modules /app/apps/api/node_modules && \
    echo "DEBUG: Creating @nestjs directory and copying packages from .pnpm..." && \
    mkdir -p /app/apps/api/node_modules/@nestjs && \
    for pkg in core common platform-express config jwt passport swagger throttler bullmq; do \
      pkg_path=$$(find /app/node_modules/.pnpm -path "*/@nestjs+$$pkg*/node_modules/@nestjs/$$pkg" -type d 2>/dev/null | head -1); \
      if [ -n "$$pkg_path" ] && [ -d "$$pkg_path" ]; then \
        echo "Copying @nestjs/$$pkg from $$pkg_path"; \
        cp -rL "$$pkg_path" /app/apps/api/node_modules/@nestjs/; \
      else \
        echo "WARNING: @nestjs/$$pkg not found in .pnpm"; \
      fi; \
    done && \
    echo "DEBUG: Verifying @nestjs/core exists..." && \
    if [ -f /app/apps/api/node_modules/@nestjs/core/package.json ]; then \
      echo "SUCCESS: @nestjs/core package.json found"; \
    else \
      echo "ERROR: @nestjs/core package.json not found"; \
      ls -la /app/apps/api/node_modules/@nestjs 2>/dev/null | head -10 || echo "No @nestjs packages found"; \
    fi \
    '

# Keep WORKDIR at /app for proper module resolution
WORKDIR /app

# Expose port
EXPOSE 8080

# Set NODE_PATH to help resolve modules from root node_modules
# This is a fallback - Node.js should find modules via normal resolution
ENV NODE_PATH=/app/node_modules

# Start the API - verify module resolution and start
CMD ["sh", "-c", "cd /app && \
  echo 'Working directory:' && pwd && \
  echo 'Verifying @nestjs/core module exists:' && \
  if [ -f /app/apps/api/node_modules/@nestjs/core/package.json ]; then \
    echo 'SUCCESS: @nestjs/core found'; \
  else \
    echo 'ERROR: @nestjs/core not found'; \
    echo 'Checking @nestjs directory:'; \
    ls -la /app/apps/api/node_modules/@nestjs 2>/dev/null | head -5 || echo 'No @nestjs directory'; \
    exit 1; \
  fi && \
  echo 'Starting application...' && \
  node apps/api/dist/main.js"]

