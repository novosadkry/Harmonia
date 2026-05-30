# Build context: monorepo root
# docker build -f apps/bot/Dockerfile -t harmonia-bot .

# ── Builder ───────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

# Build tools needed to compile @discordjs/opus native addon
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 make g++ libopus-dev curl \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp standalone binary — no Python needed at runtime
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace manifests before source so dep installs are cached separately
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db/package.json      packages/db/
COPY packages/redis/package.json   packages/redis/
COPY packages/types/package.json   packages/types/
COPY apps/bot/package.json         apps/bot/

RUN pnpm install --frozen-lockfile

# Copy full source and build
COPY packages/ packages/
COPY apps/bot/ apps/bot/

RUN pnpm --filter @harmonia/bot... build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner

# libopus0 is the shared library required by the compiled @discordjs/opus binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopus0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/bin/yt-dlp /usr/local/bin/yt-dlp

WORKDIR /app

# node_modules from builder includes the compiled .node binary and all symlinks.
# pnpm workspace symlinks (e.g. node_modules/@harmonia/db -> ../../packages/db)
# resolve correctly because packages/ is present at the same relative path.
COPY --from=builder /app/node_modules             ./node_modules
COPY --from=builder /app/packages/db/dist         packages/db/dist
COPY --from=builder /app/packages/db/package.json packages/db/package.json
COPY --from=builder /app/packages/redis/dist         packages/redis/dist
COPY --from=builder /app/packages/redis/package.json packages/redis/package.json
COPY --from=builder /app/packages/types/dist         packages/types/dist
COPY --from=builder /app/packages/types/package.json packages/types/package.json
COPY --from=builder /app/apps/bot/dist         apps/bot/dist
COPY --from=builder /app/apps/bot/package.json apps/bot/package.json
COPY package.json pnpm-workspace.yaml ./

CMD ["node", "apps/bot/dist/index.js"]
