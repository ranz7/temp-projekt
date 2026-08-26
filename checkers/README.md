# Checker service

Every checker machine runs one small HTTP service.
The app asks it to judge a submission and then asks it for the answer; the checker never calls the app and never fetches work by itself.

- `common/` is the service: its contract, its configuration, the jobs it is running and the seam it calls to judge.
- `bwrap/` is the judge behind that seam: it runs a submission inside a bubblewrap sandbox with cgroup v2 limits and reads the problem's data from disk.
- `CONTRACT.md` is the agreement with the app and wins over anything written here.

A machine holds no state.
Everything one submission needs lives in a scratch directory that is deleted when the job ends, and the whole scratch root is emptied at start-up and at shutdown.
No test data travels over HTTP: the request names a package directory and the machine reads that directory from its own disk.

## Requirements

- Python 3.12 or newer. Nothing third-party is needed, to run the service or the tests.
- The sandbox additionally needs Linux, bubblewrap, and a writable cgroup v2 tree to enforce its limits.

```bash
uv sync                 # writes uv.lock
pip install -e .        # plain pip, same result
```

## Running the service

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

`oj-checker` is the same thing once the package is installed.

The service listens on loopback by default, because the app reaches each machine through an SSH tunnel.
Setting `CHECKER_BIND=0.0.0.0` puts the checker on the network, which this deployment does not do.

Started with no `SERVICE_KEY`, the service answers `GET /health` and refuses everything else, so a machine that is misconfigured is visible rather than open.

**Running submissions without the sandbox is unsafe.**
`JUDGE_SANDBOX=none` skips bubblewrap entirely, so a submission runs with your own user's access to your own machine.
It exists so the pipeline can be developed on a machine without bubblewrap, with code you wrote yourself.

Without a writable cgroup v2 tree the judge still runs: the limits fall back to the wall-clock kill and to the process resource usage, and a warning says so.

## The three routes

- `GET /health` needs no key and says whether the machine is alive, how busy it is, and which problem packages it has on disk.
- `POST /judge` takes one submission and answers `202` with a job id; the same submission id sent twice while it runs answers the same job id, and a full machine answers `503`.
- `GET /judge/<jobId>` answers `running`, or `done` with the result. An unknown job is `404`, and a finished result is kept for at least fifteen minutes.

`CONTRACT.md` has the exact bodies.

## Judging

The service calls one function, `CHECKER_JUDGE`, by default `bwrap:run_judge`:

```python
run_judge(request, *, packages_path: Path, scratch_path: Path) -> report
```

It is resolved the first time a submission is judged, so a machine whose sandbox is missing still answers `/health` and reports a readable internal error rather than dying at start-up.
A judge that raises fails that submission alone.

## Health and shutdown

`SIGINT` and `SIGTERM` stop the service accepting new work.
Running jobs get `CHECKER_SHUTDOWN_GRACE_SECONDS` to finish, whatever is still going is marked an internal error for the app to retry, the scratch root goes, and the process exits 0.

## Environment

`CONTRACT.md` documents `SERVICE_KEY`, `CHECKER_BIND`, `CHECKER_PORT`, `CHECKER_CAPACITY`, `PROBLEM_PACKAGES_PATH`, `CHECKER_SCRATCH_PATH`, `CHECKER_RESULT_TTL_SECONDS`, `CHECKER_SHUTDOWN_GRACE_SECONDS`, `CHECKER_JUDGE` and `CHECKER_LOG_LEVEL`.
The sandbox reads these as well:

| Variable | Default | Meaning |
| --- | --- | --- |
| `JUDGE_SANDBOX` | `bwrap` | `none` turns the sandbox off, which is unsafe. |
| `BWRAP_PATH` | found on `PATH` | Where bubblewrap lives. |
| `CGROUP_ROOT` | the machine's cgroup v2 tree | Where the limits are set. |
| `PYTHON_PATH` | the running interpreter | The interpreter a submission is run with. |
| `CHECKER_VERSION` | the checkout's git revision | What `/health` reports as `version`. |

No host name, port, path or key is written into the source.

## Tests

```bash
cd checkers
python3 -m unittest discover -s tests -t . -p "test_*.py"
```

They are `unittest` and need nothing installed.
The service tests run against a real socket on a free loopback port with a stubbed judge, so they need no compiler and no sandbox.
The tests that need a writable cgroup v2 tree or bubblewrap skip with the reason when the machine has neither, which is what a macOS laptop does; they are correct on Linux and run in the container.
Nothing in the suite touches the network beyond loopback.

Ported from the reference judge: the verdict matrix, token comparison, the wall-clock deadline formula, the compile step, package and test discovery, the cgroup leaf tests and the spawn tests.
