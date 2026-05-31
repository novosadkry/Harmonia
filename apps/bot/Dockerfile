# Build context: monorepo root
# docker build -f apps/bot/Dockerfile -t harmonia-bot .

# ── Builder ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Build tools needed to compile @discordjs/opus native addon
RUN apk add --no-cache ca-certificates python3 make g++ opus-dev curl

# yt-dlp standalone binary — no Python needed at runtime
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app

# Copy workspace manifests before source so dep installs are cached separately
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/db/package.json      packages/db/
COPY packages/redis/package.json   packages/redis/
COPY packages/types/package.json   packages/types/
COPY apps/bot/package.json         apps/bot/

RUN npm ci

# Copy full source and build
COPY packages/ packages/
COPY apps/bot/ apps/bot/

RUN node_modules/.bin/turbo run build --filter=@harmonia/bot...

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

# opus-libs is the shared library required by the compiled @discordjs/opus binary
RUN apk add --no-cache opus-libs

COPY --from=builder /usr/local/bin/yt-dlp /usr/local/bin/yt-dlp

WORKDIR /app

# node_modules from builder includes the compiled .node binary and all symlinks.
# npm workspace symlinks (e.g. node_modules/@harmonia/db -> ../../packages/db)
# resolve correctly because packages/ is present at the same relative path.
COPY --from=builder /app/node_modules             ./node_modules
COPY --from=builder /app/packages/db/dist         packages/db/dist
COPY --from=builder /app/packages/db/package.json packages/db/package.json
COPY --from=builder /app/packages/redis/dist         packages/redis/dist
COPY --from=builder /app/packages/redis/package.json packages/redis/package.json
COPY --from=builder /app/packages/types/src          packages/types/src
COPY --from=builder /app/packages/types/package.json packages/types/package.json
COPY --from=builder /app/apps/bot/dist         apps/bot/dist
COPY --from=builder /app/apps/bot/package.json apps/bot/package.json
COPY package.json ./

CMD ["node", "apps/bot/dist/index.js"]
