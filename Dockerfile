# ==============================================================================
# Stage 1: Build the application
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package and lockfile
COPY package*.json ./
COPY tsconfig.json vitest.config.ts ./

# Copy workspaces package definitions
COPY packages/core/package.json ./packages/core/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN npm ci

# Copy full source
COPY packages/ ./packages/
COPY apps/ ./apps/
COPY server/ ./server/

# Build core and web
RUN npm run build

# ==============================================================================
# Stage 2: Production Realtime Server (Node 20 Alpine)
# ==============================================================================
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV DIST_DIR=/app/apps/web/dist

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built assets and server code
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY server/ ./server/

# Create persistent data volume directory
RUN mkdir -p /app/data

VOLUME /app/data

EXPOSE 3000

CMD ["node", "server/index.js"]
