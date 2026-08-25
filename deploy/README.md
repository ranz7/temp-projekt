# Running the whole thing in Docker

Two images, one command, no machine-specific setup.

```bash
docker compose up -d --build
```

That builds the app and the checker, starts Postgres 17 beside them, applies migrations, seeds the four problem packages in the repository, starts the loop runner and puts the site on <http://127.0.0.1:3210>.

```bash
curl http://127.0.0.1:3210/api/health   # 200 while the process lives
curl http://127.0.0.1:3210/api/ready    # 200 only when the database answers
docker compose ps                       # every service reports its own health
docker compose logs -f sweeper          # what is being handed out and collected
docker compose down --remove-orphans    # stop; add -v to throw the data away too
```

Bind-mount the working tree instead of rebuilding, while developing:

```bash
docker compose -f compose.yml -f deploy/compose.local.yml up -d
```

## What runs

| Container | Image | What it is |
| --- | --- | --- |
| `projekt_web` | `deploy/web/Dockerfile` | Next.js: the site, the tRPC API and the admin panel. |
| `projekt_sweeper` | the same image | The loop runner. Without it nothing is ever judged. |
| `projekt_checker` | `deploy/checker/Dockerfile.bwrap` | The checker service: judges a submission it is handed, inside bubblewrap. |
| `projekt_postgres` | `postgres:17-alpine` | The source of truth, including the submission queue. |

The app only accepts a submission into the queue.
The loop runner is what moves it: it syncs the machine registry from `CHECKER_MACHINES`, asks every machine how it is doing, hands waiting submissions to machines that are online, enabled and not full, and writes back what they answer.
Stop that container and submissions sit in the queue for ever.

The checker never calls the app, never fetches work and never posts a result.
`checkers/CONTRACT.md` is the agreement between the two and wins over anything written here.

Locally there is one checker and no SSH tunnel: the app reaches the container by its service name on the compose network, which is what `CHECKER_TUNNEL_HOST=checker` in `deploy/web/.env.example` says.
On real machines `infra/ansible/` runs the same two images, one checker per machine, each reached through a permanent SSH tunnel from the application machine.

## Files

```
compose.yml                      the whole local stack: includes the two below
deploy/compose.local.yml         development bind mounts, kept separate on purpose
deploy/web/Dockerfile            multi-stage: bun installs, node builds, node runs
deploy/web/entrypoint.sh         migrate, seed, then exec the server
deploy/web/compose.yml           the app service and the loop-runner service
deploy/web/.env.example          their settings
deploy/checker/Dockerfile.bwrap  python + bubblewrap + g++, running the HTTP service
deploy/checker/entrypoint-bwrap.sh  prepares cgroup v2, then execs the service
deploy/checker/compose.yml       the checker service
deploy/checker/.env.example      its settings
```

One compose file per service, one env file per service, a healthcheck on every service, and no `network_mode: host` anywhere.
The production-shaped compose files build or pull an image; they never bind-mount the git tree.
`infra/ansible/` renders its own `*.compose.yml` and `*.env` in the same shape and builds these same Dockerfiles on each machine.

## Configuration

Nothing is written into source or into a compose file that a deployment should be able to change.
Settings arrive as environment variables, in layers, last one wins:

1. `deploy/<service>/.env.example` - committed, safe local defaults, so a fresh clone runs with no setup.
2. `deploy/<service>/.env` - gitignored, where a deployment or a person puts real values and real secrets.

`compose.yml` itself reads the repository-root `.env` for the handful of values it substitutes: host ports, image tags and the host directory holding the problem packages.
Those are documented in the root `.env.example`.

**`SERVICE_KEY` must be the same string in `deploy/web/.env*` and `deploy/checker/.env*`.**
The app sends it as `X-Service-Key`; the checker compares it in constant time.
With a mismatch every judge call is refused and no submission is ever judged.

The app's and the loop runner's settings are `APP_ENV`, `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `DATABASE_SSL`, `SESSION_SECRET`, `SERVICE_KEY`, `CHECKER_MACHINES`, `CHECKER_TUNNEL_HOST`, `CHECKER_REQUEST_TIMEOUT_SECONDS`, `CHECKER_HEALTH_SECONDS`, `CHECKER_DISPATCH_SECONDS`, `CHECKER_RESULT_SECONDS`, `SUBMISSION_LEASE_SECONDS`, `SUBMISSION_MAX_ATTEMPTS`, `BENCHMARK_SUBMISSION_INTERVAL_MS`, `PROBLEM_PACKAGES_PATH` and `BENCHMARK_SOLUTIONS_PATH`.
The last two are set by the image itself, because both name a directory the image put there.

The checker's settings are `SERVICE_KEY`, `CHECKER_BIND`, `CHECKER_PORT`, `CHECKER_CAPACITY`, `CHECKER_RESULT_TTL_SECONDS`, `CHECKER_SHUTDOWN_GRACE_SECONDS`, `CHECKER_LOG_LEVEL`, `PROBLEM_PACKAGES_PATH`, `CHECKER_SCRATCH_PATH`, `CHECKER_JUDGE`, `JUDGE_SANDBOX`, `BWRAP_PATH`, `CGROUP_ROOT` and `PYTHON_PATH`.
Every one of them is documented, with its default, in the `.env.example` beside the compose file that loads it, and in `checkers/CONTRACT.md`.

## Health

`GET /api/health` answers 200 whenever the process is alive and touches nothing else, which is the right question for "should this container be restarted".
`GET /api/ready` asks the database `select 1`, answers 200 when it comes back and 503 with the driver's own reason when it does not, and never waits more than four seconds either way.
Neither needs the service key.

The web image's own `HEALTHCHECK` uses `/api/health`; `deploy/web/compose.yml` overrides it with `/api/ready`, because inside the stack "healthy" is what `depends_on` waits on and what an operator reads as "it can serve".

The loop runner serves nothing, so the only honest check is that the loop still exists: its healthcheck looks for the process.

The checker's healthcheck asks the service's own `GET /health` and passes only when the answer is a real one: 200, contract version 2, and the machine saying it is healthy.
`/health` also lists the package directories the machine has on disk, which is how a deployment tells a machine that can judge from one that mounted nothing.

Every process is `exec`ed, so it is PID 1 and `SIGTERM` reaches its own handler.
The checker gives running jobs `CHECKER_SHUTDOWN_GRACE_SECONDS` and marks whatever is still going an internal error for the app to retry; the loop runner finishes its pass and closes the database; the web entrypoint `exec`s the server for the same reason.

## Why the sandbox container is not `privileged`

The checker gets three grants and nothing else.
`privileged: true` would work too and would hand over every capability on the machine, so it is not used.

- **`cap_add: SYS_ADMIN`** - bubblewrap builds the sandbox by unsharing the mount, user, pid, ipc, uts and network namespaces and then `pivot_root`ing into it. Without this capability the container cannot create those namespaces at all: `bwrap: Creating new namespace failed: Operation not permitted`.
- **`cap_add: NET_ADMIN`** - `--unshare-net` gives the submission an empty network namespace, and bubblewrap then raises loopback inside it. Without this capability that last step fails and the whole run fails with it: `bwrap: loopback: Failed RTM_NEWADDR`. The submission still has no route to anywhere; the capability is spent on the empty namespace, not on the host's network.
- **`security_opt: seccomp=unconfined`** - Docker's default seccomp profile blocks `pivot_root` outright, whatever capabilities the container holds, so the sandbox cannot enter its own root: `bwrap: pivot_root: Operation not permitted`. This is the widest of the three and the reason the checker deserves its own machine, or at least its own VM, in a real deployment.

Each one was arrived at by removing it and watching the exact failure above.

cgroup v2 needs no extra grant beyond `SYS_ADMIN`, but it does need arranging, which is what `entrypoint-bwrap.sh` does before the service starts.
A container's own cgroup arrives read-only and holds the entrypoint itself, and cgroup v2 refuses to delegate controllers out of a cgroup that holds processes.
So the entrypoint remounts `/sys/fs/cgroup` writable, moves everything into a leaf of its own, and enables `+memory +pids` for the tree the judge creates its per-run leaves in.
When any of that fails - a host that will not delegate, a container started without the capability - it says so and carries on: the judge falls back to the wall-clock kill and to measured resource usage, and only the hard memory cap is lost.

## Problem packages

Hidden test files are never sent over HTTP and never baked into a checker image.
Every checker mounts a directory read-only at `PROBLEM_PACKAGES_PATH`, so any machine can judge any problem and no machine depends on a file only it has.
Locally that directory is `problems/` in this repository; a deployment points `PROBLEM_PACKAGES_HOST_PATH` at wherever it syncs packages to, and `infra/ansible/` copies them onto each machine.

The web image is the one place a copy is baked in, because seeding reads `problem.json`, the statement and the tests at first start.
It contains no checker code.

The eight reference solutions the panel's batch sends are baked in beside them, at `/app/solutions`, where `BENCHMARK_SOLUTIONS_PATH` points.
They are solutions to our own problems, written for this feature, not contest data.

## Migrations and seeding

`deploy/web/entrypoint.sh` applies migrations and seeds before the server starts, so an empty database becomes a usable site with no second command.
Both steps are safe to repeat: the migrator skips what it already applied, and the seed inserts nothing when a problem is already there.
Starting the stack a second, third and fourth time leaves exactly four problems.

The loop runner container skips the entrypoint entirely and goes straight to the loop, so migrations and the seed run once, in one place.

The runtime image carries no TypeScript toolchain.
The three operational scripts - migrate, seed and the loop runner - are bundled at build time into plain Node files under `/app/ops`.
