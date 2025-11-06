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

# Copy built artifacts and necessary files for pnpm deploy
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages ./packages
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy all package.json files from packages
COPY --from=build /app/packages/automation/package.json ./packages/automation/package.json
COPY --from=build /app/packages/content/package.json ./packages/content/package.json
COPY --from=build /app/packages/copilot/package.json ./packages/copilot/package.json
COPY --from=build /app/packages/db/package.json ./packages/db/package.json
COPY --from=build /app/packages/geo/package.json ./packages/geo/package.json
COPY --from=build /app/packages/optimizer/package.json ./packages/optimizer/package.json
COPY --from=build /app/packages/parser/package.json ./packages/parser/package.json
COPY --from=build /app/packages/prompts/package.json ./packages/prompts/package.json
COPY --from=build /app/packages/providers/package.json ./packages/providers/package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json

# Install production dependencies using pnpm
# This creates a proper node_modules structure that Node.js can resolve
# Skip Puppeteer Chrome download during install
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN pnpm install --prod --no-frozen-lockfile && \
    echo "DEBUG: Verifying critical packages can be resolved from apps/api directory..." && \
    cd /app/apps/api && \
    node -e "try { require.resolve('@nestjs/core'); console.log('SUCCESS: @nestjs/core can be resolved'); } catch(e) { console.error('ERROR: @nestjs/core cannot be resolved:', e.message); process.exit(1); }" && \
    node -e "try { require.resolve('@nestjs/swagger'); console.log('SUCCESS: @nestjs/swagger can be resolved'); } catch(e) { console.error('ERROR: @nestjs/swagger cannot be resolved:', e.message); process.exit(1); }" && \
    node -e "try { require.resolve('express'); console.log('SUCCESS: express can be resolved'); } catch(e) { console.warn('WARNING: express cannot be resolved directly (transitive dependency, should work at runtime):', e.message); }" && \
    node -e "try { require.resolve('path-to-regexp'); console.log('SUCCESS: path-to-regexp can be resolved'); } catch(e) { console.warn('WARNING: path-to-regexp cannot be resolved directly (transitive dependency, should work at runtime):', e.message); }" && \
    cd /app && \
    echo "DEBUG: Verifying workspace packages..." && \
    if [ -d /app/packages/geo ]; then \
      echo "SUCCESS: @ai-visibility/geo source found"; \
    else \
      echo "ERROR: @ai-visibility/geo source not found"; \
      exit 1; \
    fi && \
    cd /app/apps/api && \
    node -e "try { require.resolve('@ai-visibility/geo'); console.log('SUCCESS: @ai-visibility/geo can be resolved'); } catch(e) { console.warn('WARNING: @ai-visibility/geo cannot be resolved (may work at runtime):', e.message); }"

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
  echo 'Verifying @nestjs/core can be resolved from apps/api...' && \
  cd apps/api && \
  node -e \"try { require.resolve('@nestjs/core'); console.log('SUCCESS: @nestjs/core can be resolved'); } catch(e) { console.error('ERROR:', e.message); process.exit(1); }\" && \
  cd /app && \
  echo 'Starting application...' && \
  node apps/api/dist/main.js"]

