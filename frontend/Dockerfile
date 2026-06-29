# ================================================================
#  Smart Attendance — Next.js Frontend Dockerfile
#  Multi-stage build: Node.js build → minimal standalone runtime
#
#  Uses Next.js standalone output mode for the smallest possible image.
#  Set output: 'standalone' in next.config.js for this to work.
# ================================================================

# ── Stage 1: Install dependencies ─────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production --quiet

# ── Stage 2: Build the Next.js application ─────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Build args — passed from docker-compose build.args
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
RUN npm ci --quiet

COPY . .

# Build the production app
RUN npm run build

# ── Stage 3: Production runtime ────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built output
COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Next.js standalone server
CMD ["node", "server.js"]
