# Checker workers

Two standalone Python workers judge the submissions the app queues.
They share one loop and one HTTP contract; only the judging differs.

- `bwrap/` judges `python` submissions itself, inside a bubblewrap sandbox with cgroup v2 limits.
- `cpp/` hands `cpp` submissions to OIOIOI and translates its answer back.
- `common/` is the loop both of them run: claim, report running, heartbeat, judge, report or release.
- `CONTRACT.md` is the agreement with the app and wins over anything written here.

A worker holds no state.
Everything one submission needs lives in a scratch directory that is deleted when the job ends.
Hidden test files are never sent over HTTP: the job names them and the worker reads them from its own copy of the problem packages.

## Requirements

- Python 3.12 or newer. No third-party package is needed to run the tests.
- `redis` (the Python client) for wake-ups. Without it, and without a reachable Redis, the workers poll instead and keep judging.
- The sandboxed worker additionally needs Linux, bubblewrap, and a writable cgroup v2 tree to enforce its limits.

Install the dependency with either tool:

```bash
uv sync                 # writes uv.lock
pip install -e .        # plain pip, same dependency
```

## Running the sandboxed Python checker

```bash
cd checkers
SERVICE_KEY=dev-key \
APP_URL=http://127.0.0.1:3000 \
PROBLEM_PACKAGES_PATH=../problems \
CHECKER_SCRATCH_PATH=/tmp/online-judge \
CHECKER_HEALTH_PORT=8081 \
python -m bwrap
```

It claims `python` work only.
Per submission it stages the source once, then runs every test with a hard kill at twice the problem's time limit, measuring CPU time and peak memory.

**Running submissions without the sandbox is unsafe.**
`JUDGE_SANDBOX=none` skips bubblewrap entirely, so a submission runs with your own user's access to your own machine.
It exists so the pipeline can be developed on a machine without bubblewrap, with code you wrote yourself.
The sandbox is on by default and the worker refuses to start when bubblewrap is missing unless you turn it off deliberately.

Without a writable cgroup v2 tree the worker still runs: the limits fall back to the wall-clock kill and to the process resource usage, and a warning says so.

## Running the C++ checker

```bash
cd checkers
SERVICE_KEY=dev-key \
APP_URL=http://127.0.0.1:3000 \
OIOIOI_URL=https://oioioi.example \
OIOIOI_TOKEN=... \
OIOIOI_CONTEST_ID=... \
CHECKER_HEALTH_PORT=8082 \
python -m cpp
```

It claims `cpp` work only, submits the source to OIOIOI once, and polls the submission report.
The OIOIOI submission id is written into the job's scratch directory before anything else, so a worker that was restarted resumes polling instead of submitting the same source twice.

When OIOIOI is unreachable or not configured, the worker gives the submission back to the queue with a readable reason.
It never reports an internal error for an outage and it never uses up one of the submission's three attempts, so an outage only delays a solution.
The worker starts and keeps running even with no OIOIOI configured at all.

Two consequences worth knowing:

- OIOIOI reports one verdict for the whole submission, so a C++ result carries no per-test rows. An accepted solution earns every hidden point; anything else earns none.
- A job given back after the source already reached OIOIOI keeps its scratch directory, so the id survives. Every other ending deletes it.

## Health and shutdown

Each worker serves `GET /health` on `CHECKER_HEALTH_PORT` and answers 200 while it lives.
`SIGINT` and `SIGTERM` stop it claiming new work; the job in flight is finished or given back, the scratch directory goes, and the process exits 0.

## Environment

`CONTRACT.md` documents `APP_URL`, `SERVICE_KEY`, `WORKER_ID`, `PROBLEM_PACKAGES_PATH`, `CHECKER_POLL_SECONDS`, `CHECKER_HEARTBEAT_SECONDS`, `CHECKER_SCRATCH_PATH`, `CHECKER_HEALTH_PORT`, the `OIOIOI_*` settings and `BWRAP_PATH`, `CGROUP_ROOT`, `PYTHON_PATH`.
These workers read those names and defaults, plus:

| Variable | Default | Meaning |
| --- | --- | --- |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Where the wake-up stream lives. |
| `REDIS_STREAM` | `oj.submissions` | The stream a wake-up is written to. |
| `CHECKER_REQUEST_TIMEOUT_SECONDS` | `15` | How long a call to the app may take. |
| `CHECKER_LOG_LEVEL` | `INFO` | How much the worker says. |
| `OIOIOI_POLL_TIMEOUT_SECONDS` | `600` | How long one submission may wait for an OIOIOI report before the job goes back to the queue. |
| `JUDGE_SANDBOX` | `bwrap` | `none` turns the sandbox off, which is unsafe. |

No host name, port, path or key is written into the source.

## Tests

```bash
cd checkers
python3 -m unittest discover -s tests -t . -p "test_*.py"
```

They are `unittest` and need nothing installed.
The tests that need a writable cgroup v2 tree or bubblewrap skip with the reason when the machine has neither, which is what a macOS laptop does; they are correct on Linux and run in the container.
Nothing in the suite touches the network: OIOIOI, Redis and the app are all stubbed in process.

Ported from the reference judge: the verdict matrix, token comparison, the wall-clock deadline formula, the compile step, package and test discovery, the cgroup leaf tests and the spawn tests.
Ported from the reference OIOIOI adapter: the status mapping table and the submit-once-then-poll tests.
