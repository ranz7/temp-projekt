#!/bin/sh
# Hands the sandbox a writable cgroup v2 tree when the container was given enough
# privilege for one, then starts the checker service.
#
# A container's own cgroup starts read-only and holds this very process, and
# cgroup v2 refuses to delegate controllers out of a cgroup that holds processes.
# So: remount writable, move everything into a leaf of its own, then delegate.
set -e

CGROUP_ROOT="${CGROUP_ROOT:-/sys/fs/cgroup}"

prepare_cgroups() {
  mount -o remount,rw "$CGROUP_ROOT" 2>/dev/null || return 1
  mkdir -p "$CGROUP_ROOT/init" 2>/dev/null || return 1

  for pid in $(cat "$CGROUP_ROOT/cgroup.procs" 2>/dev/null); do
    echo "$pid" > "$CGROUP_ROOT/init/cgroup.procs" 2>/dev/null || true
  done

  echo '+memory +pids' > "$CGROUP_ROOT/cgroup.subtree_control" 2>/dev/null || return 1
  mkdir -p "$CGROUP_ROOT/oj" 2>/dev/null || return 1
  echo '+memory +pids' > "$CGROUP_ROOT/oj/cgroup.subtree_control" 2>/dev/null || return 1
  return 0
}

if prepare_cgroups; then
  echo "[checker] cgroup v2 is writable: memory and process limits are enforced."
else
  echo "[checker] No writable cgroup v2 tree. Limits fall back to the wall-clock kill and to measured resource usage. See deploy/README.md."
fi

mkdir -p "${CHECKER_SCRATCH_PATH:-/scratch}"

# The HTTP service, not the old pull-based worker: the app calls this machine.
# exec, so Python is PID 1 and SIGTERM reaches the service's own handler.
exec python3 -m common "$@"
