#!/bin/sh
# Brings the database to the shape this image expects, then hands over to the
# server. Both steps are safe to repeat: the migrator skips what it already
# applied and the seed inserts nothing when the problem is already there.
set -e

echo "[web] Applying database migrations."
node /app/ops/migrate.mjs

echo "[web] Seeding problem packages."
node /app/ops/seed.mjs

echo "[web] Starting $*"
# exec, so the server is PID 1 and SIGTERM reaches it instead of this shell.
exec "$@"
