#!/bin/sh
# Starts one supervisor per tunnel and keeps them running.
#
# The tunnel list is a mounted file, not something baked into the image, so
# adding a checker rewrites one file and recreates one container.
set -eu

CONF="${TUNNELS_CONF:-/etc/tunnels/tunnels.conf}"
RUN_DIR="${TUNNELS_RUN_DIR:-/run/tunnels}"

mkdir -p "$RUN_DIR"
rm -f "$RUN_DIR"/*.beat 2>/dev/null || true

if [ ! -r "$CONF" ]; then
  echo "[tunnels] No tunnel list at $CONF."
  exit 1
fi

pids=""

stop() {
  echo "[tunnels] Stopping."
  for pid in $pids; do
    kill "$pid" 2>/dev/null || true
  done
  # The supervisors kill their own ssh child, so this is enough.
  wait
  exit 0
}

trap stop TERM INT

count=0
while read -r name local_port ssh_user host remote_port; do
  case "$name" in
    '' | \#*) continue ;;
  esac

  # < /dev/null, or ssh would read the rest of the tunnel list off this loop's stdin.
  /usr/local/bin/tunnel-supervisor.sh "$name" "$local_port" "$ssh_user" "$host" "$remote_port" < /dev/null &
  pids="$pids $!"
  count=$((count + 1))
done < "$CONF"

echo "[tunnels] $count tunnels up."

# One supervisor dying is not a reason to take the other twelve down: a
# supervisor never exits on its own, so this only ends on SIGTERM.
wait
