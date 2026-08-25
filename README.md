# Online Judge

A competitive programming platform where people browse problems, submit Python or C++ solutions, watch them being judged in real time, and compete in a global ranking.
The application consists of two deployables: one Next.js web server that owns the database and serves the web interface, and stateless Python checker workers that run on other machines.
C++ submissions are handed to OIOIOI, a separate optional service not included in this repository.

## What is deployed where

**Web server** (`projekt-web`):
- One container per environment; owns PostgreSQL and Redis.
- Serves the website, the tRPC API, and internal checker endpoints.
- Health endpoints: `GET /api/health` (always 200 if alive) and `GET /api/ready` (200 only when database answers).

**Checker workers** (`projekt-checker-bwrap` and `projekt-checker-cpp`):
- Many stateless replicas; each runs one submission at a time.
- Python checker: judges Python code inside a sandboxed bubblewrap environment with CPU and memory limits.
- C++ checker: submits C++ code to OIOIOI and translates results back.
- No state on disk except a scratch directory deleted after each job.

**OIOIOI** (optional):
- A third service outside this repository; the C++ checker calls it to judge C++.
- Not configured in `.env.example`; leave it blank and C++ submissions stay queued with a readable reason.

## Language support

- **Python**: judged by the sandboxed bubblewrap checker under `checkers/bwrap/`.
- **C++**: handed to OIOIOI via the checker under `checkers/cpp/`.
- **Anything else**: refused at submit time with a validation error and never queued.

## Quick start with Docker

One command starts Postgres 17, Redis, the app, both checker workers and the seeder:

```bash
docker compose up -d --build
```

The site appears at <http://127.0.0.1:3210>.
Check health and list services:

```bash
curl http://127.0.0.1:3210/api/ready
docker compose ps
```

Scale the sandbox worker to three replicas:

```bash
docker compose up -d --scale checker-bwrap=3
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

Set up Postgres 17 and Redis on your machine, then run the app's commands from `package.json`:

```bash
# Start your own Postgres 17 and Redis instances first
# then export DATABASE_URL and REDIS_URL

# Run migrations
bun run db:migrate

# Seed the one bundled problem
bun run db:seed

# Start the web server
bun dev

# In another terminal, start a Python checker
cd checkers
SERVICE_KEY=dev-key \
APP_URL=http://127.0.0.1:3000 \
PROBLEM_PACKAGES_PATH=../problems \
CHECKER_SCRATCH_PATH=/tmp/online-judge \
CHECKER_HEALTH_PORT=8081 \
python -m bwrap

# In a third terminal, start a C++ checker (optional)
cd checkers
SERVICE_KEY=dev-key \
APP_URL=http://127.0.0.1:3000 \
CHECKER_HEALTH_PORT=8082 \
python -m cpp
```

## Environment variables

Set these in `.env` (gitignored) after copying or editing `.env.example`.
Deployment templates read from `deploy/web/.env` and `deploy/checker/.env`.

| Variable | Deployable | Default | What it does |
| --- | --- | --- | --- |
| `APP_ENV` | web | `production` | Set to `development` to enable query logging; omit for production. |
| `DATABASE_URL` | web | (none) | PostgreSQL connection URL; required. |
| `MIGRATION_DATABASE_URL` | web | (none) | Optional separate URL with higher privilege for applying migrations only. |
| `DATABASE_SSL` | web | (none) | Set to `require` when the database is over the public internet. |
| `REDIS_URL` | web, checkers | `redis://127.0.0.1:6379` | Where the wake-up stream lives; submissions judge with or without it. |
| `REDIS_STREAM` | web, checkers | `oj.submissions` | Stream name the checkers listen on. |
| `SESSION_SECRET` | web | (none) | Signing key for the login cookie; any long random string. |
| `SERVICE_KEY` | web, checkers | (none) | Shared secret sent as `X-Service-Key` header; must match between app and checkers. |
| `SUBMISSION_LEASE_SECONDS` | web | `60` | How long a claimed submission stays leased without a heartbeat. |
| `SUBMISSION_MAX_ATTEMPTS` | web | `3` | How many times a submission may be handed to a checker before it is marked internal error. |
| `SUBMISSION_QUEUE_REPOST_SECONDS` | web | `10` | How old a wake-up may get before the sweeper announces the submission again. |
| `SUBMISSION_SWEEP_SECONDS` | web | `10` | How often the sweeper container runs. |
| `PROBLEM_PACKAGES_PATH` | web, checkers | `./problems` (web); `/problems` (checkers) | Directory containing problem packages and test files. |
| `APP_URL` | checkers | `http://127.0.0.1:3000` | Base URL of the web server; checkers claim work from here. |
| `WORKER_ID` | checkers | (hostname) | Unique worker identifier; unset leaves each replica using its container name. |
| `CHECKER_POLL_SECONDS` | checkers | `1` | Delay after the app answers "no work". |
| `CHECKER_HEARTBEAT_SECONDS` | checkers | `20` | Heartbeat interval; must stay well under `SUBMISSION_LEASE_SECONDS`. |
| `CHECKER_SCRATCH_PATH` | checkers | `/tmp/online-judge` | Per-job temporary workspace; deleted when the job ends. |
| `CHECKER_HEALTH_PORT` | checkers | `8080` | Port each worker answers `GET /health` on. |
| `CHECKER_REQUEST_TIMEOUT_SECONDS` | checkers | `15` | How long a call to the app may take. |
| `CHECKER_LOG_LEVEL` | checkers | `INFO` | How much the worker logs. |
| `JUDGE_SANDBOX` | bwrap checker | `bwrap` | Set to `none` to run submissions without a sandbox (unsafe; for development only). |
| `BWRAP_PATH` | bwrap checker | `/usr/bin/bwrap` | Path to the bubblewrap executable. |
| `CGROUP_ROOT` | bwrap checker | `/sys/fs/cgroup` | Writable cgroup v2 root for CPU and memory limits. |
| `PYTHON_PATH` | bwrap checker | `/usr/bin/python3` | Python interpreter submissions run under. |
| `OIOIOI_URL` | cpp checker | (none) | Base URL of the OIOIOI service; leave empty to queue C++ submissions without judging. |
| `OIOIOI_TOKEN` | cpp checker | (none) | OIOIOI API token. |
| `OIOIOI_CONTEST_ID` | cpp checker | (none) | OIOIOI contest identifier. |
| `OIOIOI_POLL_SECONDS` | cpp checker | `2` | How often the C++ checker polls OIOIOI for results. |
| `OIOIOI_REQUEST_TIMEOUT_SECONDS` | cpp checker | `10` | HTTP request timeout for OIOIOI calls. |
| `OIOIOI_POLL_TIMEOUT_SECONDS` | cpp checker | `600` | How long one submission may wait for an OIOIOI report before it goes back to the queue. |

**Critical**: `SERVICE_KEY` must be identical in `deploy/web/.env*` and `deploy/checker/.env*`.
Mismatches silently refuse every checker call and submissions never get judged.
All secrets (not in `.env.example`) stay in `.env` only, never in git.

## Running tests

Unit tests on a fast in-memory database:

```bash
bun run test
```

Integration tests with a real PostgreSQL database (starts its own `projekt_test`):

```bash
bun run test:integration
```

Checker worker tests (no network access, all services stubbed):

```bash
cd checkers
python3 -m unittest discover -s tests -t . -p "test_*.py"
```

## How a submission travels

1. A person submits Python or C++ code from the problem page.
2. The app validates the language and saves the submission to Postgres with status `queued`.
3. The app writes the submission id to Redis for wake-up; if Redis is down, a background sweeper re-announces it.
4. A checker worker claims the submission with a time-limited lease and reports it as `running`.
5. The worker compiles (Python) or submits to OIOIOI (C++), runs every test and reports results back.
6. The app stores per-test verdicts and the final status (`accepted`, `wrong_answer`, `time_limit`, etc.).
7. The web page stops polling every second once the result is final.
8. Postgres is the source of truth; Redis is only a nudge.
   A submission survives Redis being down because the sweeper finds it again.
