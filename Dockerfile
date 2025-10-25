FROM node:22-alpine

# Install pnpm
RUN npm install -g pnpm@latest

# Set working directory
WORKDIR /app

# Copy all source code first
COPY . .

# Install dependencies without frozen lockfile
RUN pnpm install --no-frozen-lockfile

# Generate Prisma client in the workspace root
RUN cd packages/db && pnpm prisma generate

# Build the application
RUN pnpm run build

# Expose port
EXPOSE 8080

# Start the API service
CMD ["pnpm", "--filter", "@ai-visibility/api", "start"]
