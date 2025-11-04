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

# Copy node_modules to apps/api and set up @nestjs packages
# pnpm uses symlinks in node_modules pointing to .pnpm store
# We need to copy the actual package directories from .pnpm
RUN mkdir -p /app/apps/api/node_modules/@nestjs && \
    sh -c ' \
      echo "DEBUG: Finding @nestjs packages in .pnpm store..."; \
      nestjs_dir=$$(find /app/node_modules/.pnpm -type d -name "@nestjs" -path "*/node_modules/@nestjs" | head -1); \
      if [ -n "$$nestjs_dir" ]; then \
        echo "Found @nestjs directory: $$nestjs_dir"; \
        for pkg in $$nestjs_dir/*; do \
          if [ -d "$$pkg" ]; then \
            pkg_name=$$(basename "$$pkg"); \
            echo "Copying @nestjs/$$pkg_name..."; \
            cp -rL "$$pkg" /app/apps/api/node_modules/@nestjs/; \
          fi; \
        done; \
      fi; \
      echo "DEBUG: Also searching for individual @nestjs packages..."; \
      for pkg in core common platform-express config jwt passport swagger throttler bullmq; do \
        find /app/node_modules/.pnpm -type d -path "*/@nestjs+$$pkg*/node_modules/@nestjs/$$pkg" -exec cp -rL {} /app/apps/api/node_modules/@nestjs/ \; 2>/dev/null || true; \
      done; \
      echo "DEBUG: Copying common dependencies..."; \
      for pkg in tslib reflect-metadata rxjs; do \
        find /app/node_modules/.pnpm -type d -path "*/$$pkg@*/node_modules/$$pkg" -exec cp -rL {} /app/apps/api/node_modules/ \; 2>/dev/null || true; \
      done; \
      echo "DEBUG: Verifying @nestjs/core..."; \
      if [ -f /app/apps/api/node_modules/@nestjs/core/package.json ]; then \
        echo "SUCCESS: @nestjs/core found"; \
        ls -la /app/apps/api/node_modules/@nestjs/ | head -10; \
      else \
        echo "ERROR: @nestjs/core not found"; \
        echo "Listing .pnpm structure:"; \
        find /app/node_modules/.pnpm -type d -name "@nestjs" | head -5; \
        exit 1; \
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

