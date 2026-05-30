# Build context: monorepo root
# docker build -f apps/web/Dockerfile -t harmonia-web .

# ── Builder ───────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 make g++ curl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db/package.json      packages/db/
COPY packages/redis/package.json   packages/redis/
COPY packages/types/package.json   packages/types/
COPY apps/web/package.json         apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/ packages/
COPY apps/web/  apps/web/

# Build workspace deps then Next.js app
RUN pnpm --filter @harmonia/web... build

# Bundle server.ts + its local imports (e.g. socket-server.ts) into CJS.
# --packages=external leaves all npm packages as runtime requires.
RUN node_modules/.bin/esbuild apps/web/server.ts \
    --bundle \
    --platform=node \
    --format=cjs \
    --packages=external \
    --outfile=apps/web/server.js

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/node_modules             ./node_modules
COPY --from=builder /app/apps/web/.next           apps/web/.next
COPY --from=builder /app/apps/web/public          apps/web/public
COPY --from=builder /app/apps/web/server.js       apps/web/server.js
COPY --from=builder /app/apps/web/next.config.ts  apps/web/next.config.ts
COPY --from=builder /app/apps/web/package.json    apps/web/package.json
COPY --from=builder /app/packages/db/dist         packages/db/dist
COPY --from=builder /app/packages/db/package.json packages/db/package.json
COPY --from=builder /app/packages/redis/dist         packages/redis/dist
COPY --from=builder /app/packages/redis/package.json packages/redis/package.json
COPY --from=builder /app/packages/types/dist         packages/types/dist
COPY --from=builder /app/packages/types/package.json packages/types/package.json
COPY package.json pnpm-workspace.yaml ./

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
