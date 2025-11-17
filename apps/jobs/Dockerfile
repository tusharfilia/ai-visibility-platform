FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace configuration and all package.json files
COPY package.json pnpm-workspace.yaml ./
# Copy all package.json files so pnpm can properly resolve workspace dependencies
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/providers/package.json ./packages/providers/
COPY packages/parser/package.json ./packages/parser/
COPY packages/copilot/package.json ./packages/copilot/
COPY packages/automation/package.json ./packages/automation/
COPY packages/content/package.json ./packages/content/
COPY packages/geo/package.json ./packages/geo/
COPY packages/optimizer/package.json ./packages/optimizer/
COPY packages/prompts/package.json ./packages/prompts/
COPY apps/jobs/package.json ./apps/jobs/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN npm install -g pnpm
# Set CI=true to skip all interactive prompts
ENV CI=true
ENV PNPM_FORCE=true
# Skip Puppeteer Chrome download to speed up build (not needed for jobs service)
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN pnpm install --no-frozen-lockfile --force

# Copy source code
COPY . .

# Build packages in dependency order (uses root package.json build script)
# This ensures shared is built before providers to avoid TypeScript errors
RUN pnpm build

# Prepare node_modules staging area for production stage
# Copy all package node_modules to a staging directory preserving structure
RUN mkdir -p /app/staging-node_modules && \
    for dir in packages/*/node_modules apps/*/node_modules; do \
      if [ -d "$dir" ]; then \
        parent_dir=$(dirname "$dir"); \
        target_parent="/app/staging-node_modules/$parent_dir"; \
        mkdir -p "$target_parent"; \
        cp -r "$dir" "$target_parent/"; \
      fi; \
    done

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm for production install
RUN npm install -g pnpm

# Set CI environment variables
ENV CI=true
ENV PNPM_FORCE=true
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# Set NODE_PATH to include all workspace package node_modules for module resolution
ENV NODE_PATH=/app/node_modules:/app/packages/shared/node_modules:/app/packages/db/node_modules:/app/packages/providers/node_modules:/app/packages/parser/node_modules:/app/packages/copilot/node_modules:/app/packages/automation/node_modules:/app/packages/content/node_modules:/app/packages/geo/node_modules:/app/packages/optimizer/node_modules:/app/packages/prompts/node_modules:/app/apps/jobs/node_modules

# Copy workspace configuration files (needed for module resolution)
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Copy workspace package package.json files (needed for workspace resolution)
# NOTE: We copy dist folders AFTER node_modules to prevent overwriting
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/providers/package.json ./packages/providers/
COPY --from=builder /app/packages/parser/package.json ./packages/parser/
COPY --from=builder /app/packages/copilot/package.json ./packages/copilot/
COPY --from=builder /app/packages/automation/package.json ./packages/automation/
COPY --from=builder /app/packages/content/package.json ./packages/content/
COPY --from=builder /app/packages/geo/package.json ./packages/geo/
COPY --from=builder /app/packages/optimizer/package.json ./packages/optimizer/
COPY --from=builder /app/packages/prompts/package.json ./packages/prompts/
COPY --from=builder /app/apps/jobs/package.json ./apps/jobs/
COPY --from=builder /app/apps/api/package.json ./apps/api/

# Copy built application
COPY --from=builder /app/apps/jobs/dist ./dist

# Copy entire node_modules structure from builder (includes .pnpm store and all symlinks)
# This ensures all dependencies including bullmq and zod are available with correct symlink resolution
COPY --from=builder /app/node_modules ./node_modules
# Copy all workspace package node_modules from staging area (prepared in builder stage)
# This preserves symlinks and ensures dependencies like zod are accessible
# NOTE: Copy node_modules FIRST, then dist folders to ensure dist is not overwritten
COPY --from=builder /app/staging-node_modules/packages/ ./packages/
COPY --from=builder /app/staging-node_modules/apps/ ./apps/
# Re-copy dist folders AFTER node_modules to ensure they're not overwritten
COPY --from=builder /app/packages/shared/dist ./packages/shared/
COPY --from=builder /app/packages/db/dist ./packages/db/
COPY --from=builder /app/packages/providers/dist ./packages/providers/
COPY --from=builder /app/packages/parser/dist ./packages/parser/
COPY --from=builder /app/packages/copilot/dist ./packages/copilot/
COPY --from=builder /app/packages/automation/dist ./packages/automation/
COPY --from=builder /app/packages/content/dist ./packages/content/
COPY --from=builder /app/packages/geo/dist ./packages/geo/
COPY --from=builder /app/packages/optimizer/dist ./packages/optimizer/
COPY --from=builder /app/packages/prompts/dist ./packages/prompts/

# Verify critical dependencies are accessible
RUN (test -L apps/jobs/node_modules/bullmq && test -e apps/jobs/node_modules/bullmq) || (echo "ERROR: bullmq not accessible!" && exit 1)
RUN (test -L packages/shared/node_modules/zod && test -e packages/shared/node_modules/zod) || (test -L node_modules/zod && test -e node_modules/zod) || (echo "ERROR: zod not accessible!" && echo "Checking packages/shared/node_modules:" && ls -la packages/shared/node_modules/ 2>/dev/null | head -20 && echo "Checking root node_modules:" && ls -la node_modules/ | grep -E "^l.*zod|^d.*zod" || echo "zod not found" && exit 1)
# Verify workspace package symlinks resolve correctly
# Check if symlink exists and target directory exists, then verify dist/index.js through resolved path
RUN (test -L packages/copilot/node_modules/@ai-visibility/db && test -e packages/copilot/node_modules/@ai-visibility/db && test -d packages/db && test -f packages/db/dist/index.js) || (echo "ERROR: @ai-visibility/db workspace symlink not accessible!" && echo "Checking symlink:" && ls -la packages/copilot/node_modules/@ai-visibility/db 2>/dev/null && echo "Target:" && readlink -f packages/copilot/node_modules/@ai-visibility/db 2>/dev/null && echo "Checking if packages/db exists:" && ls -la packages/db/ 2>/dev/null && echo "Checking if dist exists:" && ls -la packages/db/dist/ 2>/dev/null | head -10 && exit 1)

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S worker -u 1001

# Change ownership of app directory
RUN chown -R worker:nodejs /app

USER worker

# Verify dist/index.js exists before starting
RUN test -f dist/index.js || (echo "ERROR: dist/index.js not found!" && ls -la dist/ && exit 1)

# Use node command - Railway should use this CMD directly
# This prevents Railway from trying to auto-detect and use pnpm
CMD ["node", "dist/index.js"]
