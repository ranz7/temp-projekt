# Online Judge

A competitive programming platform where people browse four problems, submit Python or C++ solutions, watch them being judged in real time, and compete in a global ranking.
The system has three parts: one Next.js web app that owns Postgres, checker machines that judge submissions, and a loop runner that moves work between them.
Both languages are judged in a sandbox on the same machines; no external services are needed.

## The three parts

**Web server** (`projekt-web`):
- One container per environment; owns PostgreSQL.
- Serves the website, the tRPC API, and the admin panel.
- Health endpoints: `GET /api/health` (always 200 if alive) and `GET /api/ready` (200 only when database answers).

**Loop runner** (`projekt-sweeper`):
- One container per environment; must be running or submissions never get judged.
- Polls all machines for health, hands waiting submissions to available machines, collects results.
- Runs inside the same image as the web server but as a separate container.

**Checker machines** (`projekt-checker`):
- One service per machine; stateless, reached only through SSH tunnel.
- Python service: judges Python and C++ code inside bubblewrap sandbox with CPU and memory limits.
- Answers health checks (no authentication needed), judge requests, and result reads (both need `SERVICE_KEY`).
- No test data baked in the image; reads from disk during judging.
- Scratch directory deleted after each job, startup, and shutdown.

## Language support

- **Python**: judged inside bubblewrap sandbox on every checker machine.
- **C++**: compiled and judged inside the same sandbox on every checker machine.
- **Anything else**: refused at submit time with a validation error and never queued.
- Four problems ship: `cf-4-A` (Watermelon), `minimizing-coins`, `rl-nearest-pairs`, and `combo` (interactive C++ only).
- Statements are Markdown rendered with KaTeX mathematics.

## Quick start with Docker

One command starts Postgres 17, the app, the loop runner, the checker, and seeds the four problems:

```bash
docker compose up -d --build
```

The site appears at <http://127.0.0.1:3210>.
Check health and view all services:

```bash
curl http://127.0.0.1:3210/api/ready
docker compose ps
```

Watch what the loop runner is doing:

```bash
docker compose logs -f sweeper
```

Scale the checker to three replicas for capacity testing:

```bash
docker compose up -d --scale checker=3
```

Stop everything and remove data:

```bash
docker compose down --remove-orphans -v
```

For development, bind-mount the source tree instead of rebuilding:

```bash
docker compose -f compose.yml -f deploy/compose.local.yml up -d
```

## Quick start without Docker

Set up Postgres 17 on your machine, then start the three parts in separate terminals.
You need bubblewrap installed to run the checker (`apt-get install bubblewrap` on Linux).

**Terminal 1: app server**

```bash
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/projekt
export SESSION_SECRET=dev-secret
export SERVICE_KEY=dev-key
export CHECKER_MACHINES='[{"name":"local","address":"127.0.0.1","localPort":8080}]'
export CHECKER_TUNNEL_HOST=127.0.0.1
bun run db:migrate
bun run db:seed
bun dev
```

**Terminal 2: checker service**

```bash
cd checkers
SERVICE_KEY=dev-key \
PROBLEM_PACKAGES_PATH=../problems \
CHECKER_SCRATCH_PATH=/tmp/online-judge \
CHECKER_BIND=127.0.0.1 \
CHECKER_PORT=8080 \
CHECKER_CAPACITY=2 \
python3 -m common
```

**Terminal 3: loop runner**

```bash
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/projekt
export SERVICE_KEY=dev-key
export CHECKER_MACHINES='[{"name":"local","address":"127.0.0.1","localPort":8080}]'
export CHECKER_TUNNEL_HOST=127.0.0.1
bun run sweep
```

## Environment variables

Settings come from `.env` (root, for local dev and Docker Compose) or `deploy/<service>/.env` (production, gitignored, layered over `.env.example`).

**Critical**: `SERVICE_KEY` must be identical everywhere; mismatches silently refuse every checker call and submissions never get judged.
All secrets stay in `.env` only, never in git.

### Web app + Loop runner

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_ENV` | `production` | Set to `development` to enable query logging. |
| `DATABASE_URL` | (none) | PostgreSQL connection URL; required. |
| `MIGRATION_DATABASE_URL` | (same as `DATABASE_URL`) | Optional separate higher-privilege URL for migrations only. |
| `DATABASE_SSL` | (none) | Set to `require` when the database is over the public internet. |
| `SESSION_SECRET` | (none) | Signing key for the login cookie; any long random string. |
| `SERVICE_KEY` | (none) | Shared secret sent as `X-Service-Key` to every checker; any long random string. |
| `CHECKER_MACHINES` | (none) | JSON array: `[{"name":"checker-01","address":"1.2.3.4","localPort":9001}]`; required to use checkers. |
| `CHECKER_TUNNEL_HOST` | `127.0.0.1` | Address the app uses to reach each checker (loopback by default, hostname or IP if not tunneled). |
| `CHECKER_REQUEST_TIMEOUT_SECONDS` | `10` | How long a call to a machine may take before timing out. |
| `CHECKER_HEALTH_SECONDS` | `5` | How often the loop runner checks every machine's health. |
| `CHECKER_DISPATCH_SECONDS` | `1` | How often the loop runner hands out waiting submissions. |
| `CHECKER_RESULT_SECONDS` | `2` | How often the loop runner collects finished results. |
| `SUBMISSION_LEASE_SECONDS` | `120` | How long a machine may hold a submission without answering before it is returned to the queue. |
| `SUBMISSION_MAX_ATTEMPTS` | `3` | How many times a submission may be handed out before it is marked an internal error. |
| `BENCHMARK_SUBMISSION_INTERVAL_MS` | `100` | Milliseconds between submissions when a batch runs. |
| `PROBLEM_PACKAGES_PATH` | `./problems` (dev); `/app/problems` (image) | Directory containing problem packages and test files. |
| `BENCHMARK_SOLUTIONS_PATH` | `./src/backend/modules/benchmark/solutions` (dev); `/app/solutions` (image) | Directory with reference solutions for batch runs. |

### Checker service

| Variable | Default | Purpose |
| --- | --- | --- |
| `SERVICE_KEY` | (none) | Shared secret; every call except `GET /health` must include it as `X-Service-Key`. |
| `CHECKER_BIND` | `127.0.0.1` | Address the service listens on (loopback by default, never exposed). |
| `CHECKER_PORT` | `8080` | Port the service listens on. |
| `CHECKER_CAPACITY` | `2` | How many submissions this machine may judge at once. |
| `CHECKER_RESULT_TTL_SECONDS` | `900` | How long a finished result stays readable. |
| `CHECKER_SHUTDOWN_GRACE_SECONDS` | `30` | How long running jobs may take to finish during shutdown. |
| `CHECKER_LOG_LEVEL` | `INFO` | How much the service logs. |
| `PROBLEM_PACKAGES_PATH` | `/problems` | Directory containing problem packages (read-only). |
| `CHECKER_SCRATCH_PATH` | `/tmp/online-judge` | Per-job temporary workspace; deleted when the job ends. |
| `CHECKER_JUDGE` | `bwrap:run_judge` | The judge behind the seam, as `module:function`. |
| `JUDGE_SANDBOX` | `bwrap` | Set to `none` to run submissions unsandboxed (unsafe; development only). |
| `BWRAP_PATH` | `/usr/bin/bwrap` | Path to the bubblewrap executable. |
| `CGROUP_ROOT` | `/sys/fs/cgroup` | Writable cgroup v2 root for CPU and memory limits. |
| `PYTHON_PATH` | `/usr/local/bin/python3` | Python interpreter submissions run under. |

Full environment documentation: `deploy/web/.env.example` (app + loop runner), `deploy/checker/.env.example` (checker), `checkers/CONTRACT.md` (contract with checkers).

## Admin panel

The `/admin` route lists every machine: name, address, reachability, enabled status, current load, last answer time, and total judged.
Machines can be disabled (no new work given, current jobs allowed to finish) and enabled again.
The panel also sends batches of test submissions: choose a problem and a count (max 500), it sends a mix of correct and deliberately wrong solutions.
Those solutions ship in the repository; no external files needed.
The panel is deliberately unrestricted (anyone who reaches the address can use it); this is a feature, not a bug, for this deployment.

## Production deployment

One command sets up the whole system - the app, loop runner, all checkers, and the SSH tunnels that reach them:

```bash
make deploy
```

See `infra/README.md` for the full setup (one inventory file listing machines, one secrets file, one command to deploy all).
SSH tunnels keep all checkers invisible from the internet; only the SSH port (which already exists) is used.
Running the command again safely changes only what differs and does not disturb submissions being judged.

## SSH tunnels and checker access

Every checker machine runs its service on its own loopback address (127.0.0.1).
The app reaches each checker through a permanent SSH tunnel opened from the application machine.
This means no firewall rule is needed anywhere, and a checker that reboots automatically reconnects within five seconds.
The tunnel arrangement is handled entirely by `infra/ansible/`; locally with Docker Compose there is no tunnel (the app reaches the checker by service name on the compose network).

## Running tests

App unit tests (in-memory database):

```bash
bun run test
```

App integration tests (real Postgres, creates `projekt_test` database):

```bash
bun run test:integration
```

Checker tests (no network, all services stubbed):

```bash
cd checkers
python3 -m unittest discover -s tests -t . -p "test_*.py"
```

## How a submission travels

1. A person submits Python or C++ code from a problem page.
2. The app validates the language, checks the problem accepts it, saves the submission to Postgres with status `queued`.
3. The loop runner's dispatch pass (every 1 second) finds queued submissions and asks an available, enabled machine to judge.
4. The machine accepts the job, returns a job ID, and judges in the background (compilation + all tests).
5. The loop runner's collect pass (every 2 seconds) polls the machine for the result of each job it handed out.
6. The machine returns per-test verdicts and the final status (`accepted`, `wrong_answer`, `time_limit`, `runtime_error`, etc.).
7. The loop runner writes the result back to Postgres; the submission status becomes final.
8. The web page stops polling every second once the result is final.
9. If a machine stops answering, the loop runner returns the submission to the queue and another machine picks it up (up to 3 attempts).
10. Without the loop runner running, submissions sit in the queue forever; the operational difference is striking and critical to document.
