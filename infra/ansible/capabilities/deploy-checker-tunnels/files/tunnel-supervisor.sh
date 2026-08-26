#!/bin/sh
# One tunnel: a local port on this container forwarded to one checker's own
# loopback, dialled again whenever it drops.
#
#   tunnel-supervisor.sh NAME LOCAL_PORT SSH_USER HOST REMOTE_PORT
#
# ExitOnForwardFailure means a session that cannot open the forward ends instead
# of sitting there looking connected. The keepalives notice a dead peer in about
# forty-five seconds, which is what makes a tunnel come back after a checker
# reboots or a network drops it silently.
set -eu

name="$1"
local_port="$2"
ssh_user="$3"
host="$4"
remote_port="$5"

run_dir="${TUNNELS_RUN_DIR:-/run/tunnels}"
key="${TUNNELS_KEY:-/etc/tunnels/id_ed25519}"
known_hosts="${TUNNELS_KNOWN_HOSTS:-/etc/tunnels/known_hosts}"
retry="${TUNNELS_RETRY_SECONDS:-5}"
beat="$run_dir/$name.beat"

child=""
stop() {
  [ -n "$child" ] && kill "$child" 2>/dev/null || true
  exit 0
}
trap stop TERM INT

mkdir -p "$run_dir"

while :; do
  touch "$beat"

  ssh -N -T -n \
    -o BatchMode=yes \
    -o ExitOnForwardFailure=yes \
    -o ConnectTimeout=10 \
    -o ServerAliveInterval=15 \
    -o ServerAliveCountMax=3 \
    -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile="$known_hosts" \
    -o IdentitiesOnly=yes \
    -i "$key" \
    -L "0.0.0.0:${local_port}:127.0.0.1:${remote_port}" \
    "${ssh_user}@${host}" &
  child=$!

  # A heartbeat while the session lives, so the container's healthcheck can tell
  # a supervisor that is working from one that has died.
  while kill -0 "$child" 2>/dev/null; do
    touch "$beat"
    sleep 5
  done

  wait "$child" 2>/dev/null || true
  child=""
  echo "[tunnels] $name ($ssh_user@$host) dropped. Dialling again in ${retry}s."
  sleep "$retry"
done
