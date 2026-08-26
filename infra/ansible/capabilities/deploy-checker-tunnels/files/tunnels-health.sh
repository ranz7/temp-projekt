#!/bin/sh
# Healthy means every supervisor is alive, not that every checker is up.
#
# A checker that is down is the app's business - it asks each machine how it is
# and stops giving work to one that does not answer. This container is unhealthy
# only when a supervisor has stopped trying, which is what Docker should restart.
set -eu

CONF="${TUNNELS_CONF:-/etc/tunnels/tunnels.conf}"
RUN_DIR="${TUNNELS_RUN_DIR:-/run/tunnels}"
STALE_SECONDS="${TUNNELS_STALE_SECONDS:-60}"

expected=$(grep -cve '^[[:space:]]*$' -e '^[[:space:]]*#' "$CONF" || true)
now=$(date +%s)
alive=0

for beat in "$RUN_DIR"/*.beat; do
  [ -e "$beat" ] || continue
  age=$((now - $(stat -c %Y "$beat")))
  [ "$age" -le "$STALE_SECONDS" ] && alive=$((alive + 1))
done

if [ "$alive" -lt "$expected" ]; then
  echo "only $alive of $expected tunnel supervisors are alive"
  exit 1
fi

exit 0
