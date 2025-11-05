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

# Copy node_modules from build stage (includes .pnpm virtual store)
COPY --from=build /app/node_modules ./node_modules

# Copy all dependencies from .pnpm virtual store to apps/api/node_modules
# pnpm stores packages in .pnpm/<package>@<version>/node_modules/<package>
# For scoped packages like @nestjs/swagger, pnpm uses @nestjs+swagger@version in the directory name
# We need to preserve the relative path from node_modules for scoped packages
# Skip bare scoped directories (like @nestjs without a subpackage) - only copy actual packages
RUN echo "DEBUG: Copying all packages from .pnpm virtual store..." && \
    mkdir -p /app/apps/api/node_modules && \
    echo "DEBUG: Finding @nestjs/core in .pnpm..." && \
    find /app/node_modules/.pnpm -path "*/@nestjs/core" -type d | head -3 && \
    echo "DEBUG: Finding node_modules containing @nestjs/core..." && \
    find /app/node_modules/.pnpm -type d -name "node_modules" -exec sh -c ' \
      if [ -d "{}/@nestjs/core" ]; then \
        echo "Found @nestjs/core in {}"; \
        ls -la "{}/@nestjs/core" | head -3; \
      fi \
    ' \; | head -5 && \
    echo "DEBUG: Starting copy process..." && \
    find /app/node_modules/.pnpm -type d -name "node_modules" -exec sh -c ' \
      nm_dir="{}"; \
      for pkg_dir in "$nm_dir"/*; do \
        # Check if it's a directory or symlink to directory \
        if [ -d "$pkg_dir" ] || [ -L "$pkg_dir" ]; then \
          # Get relative path from node_modules directory (e.g., @nestjs/core or package-name) \
          rel_path=$(echo "$pkg_dir" | sed "s|^$nm_dir/||"); \
          # Debug ALL @nestjs entries to see what we're getting \
          if echo "$rel_path" | grep -q "^@nestjs"; then \
            echo "DEBUG: Processing @nestjs entry: rel_path=$rel_path, pkg_dir=$pkg_dir, nm_dir=$nm_dir"; \
          fi; \
          # Skip bare scoped directories (e.g., just @nestjs) - only copy actual packages \
          if echo "$rel_path" | grep -q "^@"; then \
            if ! echo "$rel_path" | grep -q "/"; then \
              # This is a bare scoped directory like @nestjs, skip it \
              if echo "$rel_path" | grep -q "^@nestjs"; then \
                echo "DEBUG: Skipping bare @nestjs directory"; \
              fi; \
              continue; \
            fi; \
          fi; \
          dest_path="/app/apps/api/node_modules/$rel_path"; \
          # Create parent directory if it's a scoped package \
          if echo "$rel_path" | grep -q "/"; then \
            parent_dir=$(dirname "$dest_path"); \
            mkdir -p "$parent_dir"; \
          fi; \
          # Copy if destination doesn't exist (force copy to handle updates) \
          if [ ! -d "$dest_path" ] || [ ! -f "$dest_path/package.json" ]; then \
            if echo "$rel_path" | grep -q "^@nestjs/core"; then \
              echo "DEBUG: Copying @nestjs/core from $pkg_dir to $dest_path"; \
              ls -la "$pkg_dir" | head -3; \
            fi; \
            cp -rL "$pkg_dir" "$dest_path" 2>&1 || echo "ERROR: Failed to copy $rel_path"; \
            if echo "$rel_path" | grep -q "^@nestjs/core"; then \
              echo "DEBUG: After copy, checking $dest_path"; \
              ls -la "$dest_path" 2>/dev/null | head -3 || echo "ERROR: Destination not created"; \
            fi; \
          else \
            if echo "$rel_path" | grep -q "^@nestjs/core"; then \
              echo "DEBUG: @nestjs/core already exists at $dest_path, skipping"; \
            fi; \
          fi; \
        fi; \
      done \
    ' \; && \
    echo "DEBUG: Copy completed. Checking for @nestjs..." && \
    find /app/apps/api/node_modules -name "@nestjs" -type d && \
    echo "DEBUG: Listing @nestjs directory contents:" && \
    ls -la /app/apps/api/node_modules/@nestjs 2>/dev/null | head -20 || echo "No @nestjs directory found" && \
    echo "DEBUG: Verifying @nestjs/core..." && \
    if [ -f /app/apps/api/node_modules/@nestjs/core/package.json ]; then \
      echo "SUCCESS: @nestjs/core found"; \
    else \
      echo "ERROR: @nestjs/core not found" && \
      ls -la /app/apps/api/node_modules/@nestjs 2>/dev/null | head -10 || echo "No @nestjs directory"; \
      exit 1; \
    fi && \
    echo "DEBUG: Verifying @nestjs/swagger..." && \
    if [ -f /app/apps/api/node_modules/@nestjs/swagger/package.json ]; then \
      echo "SUCCESS: @nestjs/swagger found"; \
    else \
      echo "ERROR: @nestjs/swagger not found" && \
      echo "Listing @nestjs directory:" && \
      ls -la /app/apps/api/node_modules/@nestjs 2>/dev/null | head -20 || echo "No @nestjs directory"; \
      echo "Searching for swagger in .pnpm:" && \
      find /app/node_modules/.pnpm -name "*swagger*" -type d 2>/dev/null | head -5 || echo "No swagger found"; \
      exit 1; \
    fi && \
    echo "DEBUG: Verifying js-yaml..." && \
    if [ -d /app/apps/api/node_modules/js-yaml ]; then \
      echo "SUCCESS: js-yaml found"; \
    else \
      echo "WARNING: js-yaml not found, listing node_modules:" && \
      ls -la /app/apps/api/node_modules/ | head -30; \
    fi

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

