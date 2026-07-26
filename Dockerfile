# Multi-stage Next.js 16 production build for Cloud Run.
# Ships the .next/standalone output (server.js + traced runtime deps).
# Build context is the repo root:  docker build -t ethglobal-bridge .
FROM node:20-alpine AS base

# --- Stage 1: dependencies ---
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# --- Stage 2: build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
# NEXT_PUBLIC_* are inlined into the client bundle at build time, so they
# must be present now (passed via --build-arg from deploy-app.sh). Everything
# else is server-side and loaded at runtime from /secrets/.env.
ARG NEXT_PUBLIC_PRIVY_APP_ID
ARG NEXT_PUBLIC_WORLD_APP_ID
ARG NEXT_PUBLIC_WORLD_ACTION_IDENTITY
ARG NEXT_PUBLIC_WORLD_ACTION_SELFIE
ARG NEXT_PUBLIC_WORLD_ALLOW_SKIP
ARG NEXT_PUBLIC_WORLD_SANDBOX
ENV NEXT_PUBLIC_PRIVY_APP_ID=${NEXT_PUBLIC_PRIVY_APP_ID}
ENV NEXT_PUBLIC_WORLD_APP_ID=${NEXT_PUBLIC_WORLD_APP_ID}
ENV NEXT_PUBLIC_WORLD_ACTION_IDENTITY=${NEXT_PUBLIC_WORLD_ACTION_IDENTITY}
ENV NEXT_PUBLIC_WORLD_ACTION_SELFIE=${NEXT_PUBLIC_WORLD_ACTION_SELFIE}
ENV NEXT_PUBLIC_WORLD_ALLOW_SKIP=${NEXT_PUBLIC_WORLD_ALLOW_SKIP}
ENV NEXT_PUBLIC_WORLD_SANDBOX=${NEXT_PUBLIC_WORLD_SANDBOX}
RUN npm run build

# --- Stage 3: runtime ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Loads the Cloud Run env-file secret (/secrets/.env) into process.env
# before starting the standalone server.
COPY deploy/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
EXPOSE 8080
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
