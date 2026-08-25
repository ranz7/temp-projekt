# The Next.js app: UI, tRPC API and the internal checker endpoints.
#
# Bun installs and bundles; Node builds and runs. Nothing about the checkers,
# OIOIOI or any contest data beyond the problem packages already in this
# repository ends up in the image.

FROM oven/bun:1.2.23-alpine AS bun

# ---------------------------------------------------------------- dependencies
FROM node:22.23.1-alpine AS deps
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# --------------------------------------------------------------------- builder
FROM node:22.23.1-alpine AS builder
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Collecting page data imports the database module, which refuses to load without
# a connection URL. This placeholder is never connected to and never leaves the
# builder stage; the real value arrives from the environment at run time.
ARG DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
ENV DATABASE_URL=${DATABASE_URL}

RUN ./node_modules/.bin/next build

# The runtime carries no TypeScript toolchain, so the three operational scripts
# are bundled here into plain Node files: migrate, seed and the queue sweeper.
RUN bun build src/backend/database/scripts/db-migrate.ts --target=node --outfile=ops/migrate.mjs \
 && bun build src/backend/database/seed.ts --target=node --outfile=ops/seed.mjs \
 && bun build src/backend/modules/submission/scripts/run-sweeper.ts --target=node --outfile=ops/sweeper.mjs

# ---------------------------------------------------------------------- runner
FROM node:22.23.1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# The port inside the container is fixed; the port on the host is a compose setting.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/ops ./ops
# The migrator reads the SQL files at run time, from the path it was compiled with.
COPY --from=builder --chown=nextjs:nodejs /app/src/backend/database/migrations ./src/backend/database/migrations
# Problem packages ship with the repository; seeding reads them at first start.
COPY --from=builder --chown=nextjs:nodejs /app/problems ./problems
COPY --chown=nextjs:nodejs deploy/web/entrypoint.sh ./entrypoint.sh

USER nextjs

EXPOSE 3000

# start-period covers migrate and seed; after that a few seconds of failures is
# enough to call the container unhealthy.
HEALTHCHECK --interval=5s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q -O - "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
CMD ["node", "server.js"]
