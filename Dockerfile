# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps – install dependencies (cached, scoped per target architecture)
# ---------------------------------------------------------------------------
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
ARG TARGETARCH
COPY package.json package-lock.json ./
# Scope the npm cache per architecture: a multi-arch build must never reuse
# platform-specific artefacts (e.g. sharp's native libvips bindings).
RUN --mount=type=cache,id=npm-${TARGETARCH},target=/root/.npm npm ci

# ---------------------------------------------------------------------------
# builder – produce the standalone Next.js output (`.next/standalone`)
# ---------------------------------------------------------------------------
FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next/font/google` (Geist) downloads the font files during the build, so this
# stage needs outbound network access.
RUN npm run build

# ---------------------------------------------------------------------------
# runner – only the traced standalone server, static assets and public/
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder /app/public ./public
# `standalone` holds server.js plus every traced server/node_modules file.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Two paths the app writes to at runtime:
#   .next/cache  → Next.js server cache (`use cache`, cacheLife) and ISR
#   data/cache   → Migros product/price cache (lib/migros/cache.ts)
# Both are created and owned by the runtime user here so that bind-mounted host
# directories (see docker-compose.yml) are writable by uid/gid 1001.
# Deliberately no VOLUME instruction: persistence is the caller's decision, and
# declaring one would spawn throwaway anonymous volumes for plain `docker run`.
RUN mkdir -p /app/.next/cache /app/data/cache \
    && chown -R nextjs:nodejs /app/.next /app/data

USER nextjs
EXPOSE 3000
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Next.js' standalone entry point; it handles SIGTERM/SIGINT gracefully.
CMD ["node", "server.js"]
