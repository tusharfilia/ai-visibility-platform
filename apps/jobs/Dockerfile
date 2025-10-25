FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/providers/package.json ./packages/providers/
COPY packages/parser/package.json ./packages/parser/
COPY packages/copilot/package.json ./packages/copilot/
COPY apps/jobs/package.json ./apps/jobs/

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build packages
RUN pnpm -r build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy built application
COPY --from=builder /app/apps/jobs/dist ./dist
COPY --from=builder /app/apps/jobs/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S worker -u 1001
USER worker

CMD ["node", "dist/index.js"]
