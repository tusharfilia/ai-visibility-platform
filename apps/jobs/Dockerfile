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

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Set CI environment variables
ENV CI=true
ENV NODE_ENV=production

# Copy workspace configuration files (needed for module resolution)
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Copy all package.json files (needed for workspace resolution)
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

# Copy built workspace packages (needed for workspace dependencies)
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/providers/dist ./packages/providers/dist
COPY --from=builder /app/packages/parser/dist ./packages/parser/dist
COPY --from=builder /app/packages/copilot/dist ./packages/copilot/dist
COPY --from=builder /app/packages/automation/dist ./packages/automation/dist
COPY --from=builder /app/packages/content/dist ./packages/content/dist
COPY --from=builder /app/packages/geo/dist ./packages/geo/dist
COPY --from=builder /app/packages/optimizer/dist ./packages/optimizer/dist
COPY --from=builder /app/packages/prompts/dist ./packages/prompts/dist

# Copy built application
COPY --from=builder /app/apps/jobs/dist ./dist

# Copy entire node_modules and .pnpm store from builder
# This ensures all dependencies (including bullmq) are available
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.pnpm ./.pnpm

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
