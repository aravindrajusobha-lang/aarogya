# =========================================================================
# Aarogya-Drishti: Core Backend API Server Dockerfile (Production Multi-Stage)
# Platform: Node.js 20 LTS Alpine | Replica Set Compatible
# =========================================================================

# Stage 1: Build & Compilation
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools for native addons (e.g. argon2)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Stage 2: Production Execution Environment
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=5000
ENV SIMULATION_MODE=true

COPY package*.json ./
# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript output and asset files
COPY --from=builder /app/dist ./dist
COPY src/i18n/locales ./dist/i18n/locales

# Create non-root system user for container security
USER node

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/v1/health || exit 1

CMD ["node", "dist/server.js"]
