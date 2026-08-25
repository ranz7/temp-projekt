# Running the whole thing in Docker

Three images, one command, no machine-specific setup.

```bash
docker compose up -d --build
```

That builds the app and both checker workers, starts Postgres 17 and Redis beside them, applies migrations, seeds the one problem package in the repository and puts the site on <http://127.0.0.1:3210>.

```bash
curl http://127.0.0.1:3210/api/health   # 200 while the process lives
curl http://127.0.0.1:3210/api/ready    # 200 only when the database answers
docker compose ps                       # every service reports its own health
docker compose down --remove-orphans    # stop; add -v to throw the data away too
```

Several sandbox workers:

```bash
docker compose up -d --scale checker-bwrap=3
```

Bind-mount the working tree instead of rebuilding, while developing:

```bash
docker compose -f compose.yml -f deploy/compose.local.yml up -d
```

## What runs

| Container | Image | What it is |
| --- | --- | --- |
| `projekt_web` | `deploy/web/Dockerfile` | Next.js: the site, the tRPC API and the internal checker endpoints. |
| `projekt_sweeper` | the same image | Re-queues submissions whose lease ran out and announces forgotten ones. |
| `projekt-checker-bwrap-N` | `deploy/checker/Dockerfile.bwrap` | Judges Python submissions itself, inside bubblewrap. |
| `projekt-checker-cpp-N` | `deploy/checker/Dockerfile.cpp` | Hands C++ submissions to OIOIOI and translates the answer back. |
| `projekt_postgres` | `postgres:17-alpine` | The source of truth for everything except hidden test files. |
| `projekt_redis` | `redis:7.4-alpine` | The wake-up channel. A submission is judged with or without it. |

The two checkers carry no container name and publish no host port, because either would make `docker compose up --scale` fail.
Compose names their replicas `projekt-checker-bwrap-1`, `-2`, `-3` and so on, which is stable enough to read a log by.

OIOIOI is a third runtime dependency, like Postgres, and lives outside this repository.
Nothing here starts it and no image contains it.
Left unconfigured, the C++ worker still starts, still claims C++ work and gives every C++ submission straight back to the queue with a readable reason, without using up one of its three attempts.

## Files

```
compose.yml                      the whole local stack: includes the two below
deploy/compose.local.yml         development bind mounts, kept separate on purpose
deploy/web/Dockerfile            multi-stage: bun installs, node builds, node runs
deploy/web/entrypoint.sh         migrate, seed, then exec the server
deploy/web/compose.yml           the web service and the sweeper service
deploy/web/.env.example          their settings
deploy/checker/Dockerfile.bwrap  python + bubblewrap
deploy/checker/entrypoint-bwrap.sh  prepares cgroup v2, then execs the worker
deploy/checker/Dockerfile.cpp    python only, unprivileged, non-root
deploy/checker/compose.yml       both checker services
deploy/checker/.env.example      their settings
```

One compose file per service, one env file per service, a healthcheck on every service, a stable container name wherever scaling allows one, and no `network_mode: host` anywhere.
The production-shaped compose files build or pull an image; they never bind-mount the git tree.
A later Ansible pass renders `*.compose.yml` and `*.env` from these and runs `docker compose up -d`.
There is no Ansible in this repository yet, deliberately.

## Configuration

Nothing is written into source or into a compose file that a deployment should be able to change.
Settings arrive as environment variables, in layers, last one wins:

1. `deploy/<service>/.env.example` - committed, safe local defaults, so a fresh clone runs with no setup.
2. `deploy/<service>/.env` - gitignored, where a deployment or a person puts real values and real secrets.

`compose.yml` itself reads the repository-root `.env` for the handful of values it substitutes: host ports, image tags and the host directory holding the problem packages.
Those are documented in the root `.env.example`.

**`SERVICE_KEY` must be the same string in `deploy/web/.env*` and `deploy/checker/.env*`.**
The workers send it as `X-Service-Key`; the app compares it.
With a mismatch every claim is refused and no submission is ever judged, quietly.

The app's settings are `APP_ENV`, `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `DATABASE_SSL`, `SESSION_SECRET`, `SERVICE_KEY`, `REDIS_URL`, `REDIS_STREAM`, `SUBMISSION_LEASE_SECONDS`, `SUBMISSION_MAX_ATTEMPTS`, `SUBMISSION_QUEUE_REPOST_SECONDS`, `SUBMISSION_SWEEP_SECONDS` and `PROBLEM_PACKAGES_PATH`.
The workers' settings are `APP_URL`, `SERVICE_KEY`, `WORKER_ID`, `PROBLEM_PACKAGES_PATH`, `CHECKER_POLL_SECONDS`, `CHECKER_HEARTBEAT_SECONDS`, `CHECKER_SCRATCH_PATH`, `CHECKER_HEALTH_PORT`, `CHECKER_REQUEST_TIMEOUT_SECONDS`, `CHECKER_LOG_LEVEL`, `REDIS_URL`, `REDIS_STREAM`, `JUDGE_SANDBOX`, `BWRAP_PATH`, `CGROUP_ROOT`, `PYTHON_PATH` and the `OIOIOI_*` group.
Every one of them is documented, with its default, in the `.env.example` beside the compose file that loads it.

`WORKER_ID` is deliberately left unset.
Unset, each replica names itself after its own container, which is exactly what scaling needs; set in the shared env file, every replica would claim the same identity.

## Health

`GET /api/health` answers 200 whenever the process is alive and touches nothing else, which is the right question for "should this container be restarted".
`GET /api/ready` asks the database `select 1`, answers 200 when it comes back and 503 with the driver's own reason when it does not, and never waits more than four seconds either way.
Neither needs the service key.

The web image's own `HEALTHCHECK` uses `/api/health`; `deploy/web/compose.yml` overrides it with `/api/ready`, because inside the stack "healthy" is what `depends_on` waits on and what an operator reads as "it can serve".

Each worker serves `GET /health` on `CHECKER_HEALTH_PORT` inside its own container, and its image healthcheck asks that port.
Nothing is published to the host, so every replica may use the same port number.

Both workers are `exec`ed, so Python is PID 1 and `SIGTERM` reaches its own handler: the job in flight finishes or is given back, the scratch directory goes, and the process exits 0.
The web entrypoint `exec`s the server for the same reason.

## Why the sandbox container is not `privileged`

The bubblewrap worker gets three grants and nothing else.
`privileged: true` would work too and would hand over every capability on the machine, so it is not used.

- **`cap_add: SYS_ADMIN`** - bubblewrap builds the sandbox by unsharing the mount, user, pid, ipc, uts and network namespaces and then `pivot_root`ing into it. Without this capability the container cannot create those namespaces at all: `bwrap: Creating new namespace failed: Operation not permitted`.
- **`cap_add: NET_ADMIN`** - `--unshare-net` gives the submission an empty network namespace, and bubblewrap then raises loopback inside it. Without this capability that last step fails and the whole run fails with it: `bwrap: loopback: Failed RTM_NEWADDR`. The submission still has no route to anywhere; the capability is spent on the empty namespace, not on the host's network.
- **`security_opt: seccomp=unconfined`** - Docker's default seccomp profile blocks `pivot_root` outright, whatever capabilities the container holds, so the sandbox cannot enter its own root: `bwrap: pivot_root: Operation not permitted`. This is the widest of the three and the reason the worker deserves its own machine, or at least its own VM, in a real deployment.

Each one was arrived at by removing it and watching the exact failure above.

cgroup v2 needs no extra grant beyond `SYS_ADMIN`, but it does need arranging, which is what `entrypoint-bwrap.sh` does before the worker starts.
A container's own cgroup arrives read-only and holds the entrypoint itself, and cgroup v2 refuses to delegate controllers out of a cgroup that holds processes.
So the entrypoint remounts `/sys/fs/cgroup` writable, moves everything into a leaf of its own, and enables `+memory +pids` for the tree the worker creates its per-run leaves in.
When any of that fails - a host that will not delegate, a container started without the capability - it says so and carries on: the worker falls back to the wall-clock kill and to measured resource usage, and only the hard memory cap is lost.

The C++ worker gets none of this.
It compiles nothing and runs nothing, so it holds no extra capability, keeps the default seccomp profile and runs as an unprivileged user.

## Problem packages

Hidden test files are never sent over HTTP and never baked into a worker image.
Every checker replica mounts the same directory read-only at `PROBLEM_PACKAGES_PATH`, so any replica can judge any problem and no replica depends on a file only it has.
Locally that directory is `problems/` in this repository; a deployment points `PROBLEM_PACKAGES_HOST_PATH` at wherever it syncs packages to.

The web image is the one place a copy is baked in, because seeding reads `problem.json`, the statement and the samples at first start.
It contains no checker code, no OIOIOI and no contest data beyond that one package.

## Migrations and seeding

`deploy/web/entrypoint.sh` applies migrations and seeds before the server starts, so an empty database becomes a usable site with no second command.
Both steps are safe to repeat: the migrator skips what it already applied, and the seed inserts nothing when the problem is already there.
Starting the stack a second, third and fourth time leaves exactly one problem and its twenty-one tests.

The runtime image carries no TypeScript toolchain.
The three operational scripts - migrate, seed and the sweeper loop - are bundled at build time into plain Node files under `/app/ops`.
