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

# Build core and web
RUN npm run build

# ==============================================================================
# Stage 2: Serve with Nginx Alpine
# ==============================================================================
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
