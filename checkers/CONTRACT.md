# Checker service HTTP contract

This document defines contract version 2 between the Next.js app and one checker machine.
Every JSON request and response body contains `"contractVersion": 2`.
A different version is refused with `400 Bad Request` instead of being interpreted as version 2.

Version 2 turns the direction around.
The app calls the checker; a checker never calls the app, never claims work and never posts a result back.
A checker reads every problem's data - tests, limits, the problem's own checker or grader - from its own disk under `PROBLEM_PACKAGES_PATH/<packageDirectory>/`.

## Transport and authentication

Each checker machine runs this service on its own loopback address.
The app reaches it through an SSH tunnel opened from the application machine, so nothing is exposed to the internet and no firewall rule is needed.

Every endpoint except `GET /health` requires `X-Service-Key: <SERVICE_KEY>`, compared in constant time.
A missing or wrong key returns `401 Unauthorized` and judges nothing.
A checker started with no `SERVICE_KEY` refuses everything except `GET /health`.
No call uses cookies.

Every response body is JSON and names the contract version.
An error carries a readable reason:

```json
{ "contractVersion": 2, "error": "a valid X-Service-Key header is required" }
```

## Health

`GET /health` needs no key, so a deployment can check the machine is alive.

```json
{
  "contractVersion": 2,
  "ok": true,
  "busy": 1,
  "capacity": 2,
  "problems": ["cf-4-A", "combo", "minimizing-coins", "rl-nearest-pairs"],
  "version": "3240be9"
}
```

- `busy` is how many submissions this machine is judging right now, `capacity` how many it may judge at once.
- `problems` lists the package directories actually present on this machine's disk, so the app can tell whether the machine can judge a given problem. A directory counts when it holds a `problem.json` or a `tests` directory.
- `version` is the checker's git revision, or its package version when it does not run from a checkout.

## Judge a submission

`POST /judge` asks the machine to judge one submission.

```json
{
  "contractVersion": 2,
  "submissionId": "0198df77-9122-7000-8000-000000000001",
  "problemSlug": "combo",
  "packageDirectory": "combo",
  "language": "cpp",
  "sourceCode": "int main() {}\n"
}
```

`packageDirectory` is a single directory name; anything that could point elsewhere is refused.
No tests, limits or checker settings travel over HTTP: the machine reads them from that directory.

The answer is `202 Accepted`, and judging starts in the background:

```json
{ "contractVersion": 2, "jobId": "8f14e45fceea167a5a36dedd4bea2543" }
```

- Sending the same `submissionId` again while it is still being judged answers the same `jobId` and judges nothing twice.
- A machine already at capacity answers `503 Service Unavailable` with a readable reason and queues nothing. The queue lives in the app.
- A body that is not this contract answers `400 Bad Request`.

## Read a result

`GET /judge/<jobId>` reads a job back.

While it is being judged:

```json
{ "contractVersion": 2, "status": "running" }
```

When it has finished:

```json
{
  "contractVersion": 2,
  "status": "done",
  "result": {
    "status": "accepted",
    "score": 20,
    "maxScore": 20,
    "compileMessage": null,
    "maxCpuMs": 12,
    "maxMemoryKb": 4096,
    "tests": [
      {
        "ordinal": 1,
        "visibility": "public",
        "verdict": "passed",
        "passed": true,
        "pointsAwarded": 0,
        "message": null,
        "actualOutput": "YES\n",
        "timeMs": 10,
        "memoryKb": 4096,
        "name": "001",
        "presses": null
      }
    ]
  }
}
```

An unknown `jobId` answers `404 Not Found`.
A finished result stays readable for at least fifteen minutes and may be discarded after that, so an unknown job is either a job that never existed or one the app was too slow to read.

### Words the app accepts

`result.status` is one of `accepted`, `wrong_answer`, `time_limit`, `memory_limit`, `runtime_error`, `compilation_error`, `internal_error`.

`tests[].verdict` is one of `passed`, `wrong_answer`, `time_limit`, `memory_limit`, `runtime_error`.
There is no per-test internal error: a submission the machine cannot judge at all is one `internal_error` with no rows.

`tests[].visibility` is `public` or `hidden`.

A test row carries no database id.
The app matches rows to its own tests by `ordinal`, counted from 1 in the order the package lists them.
`name` is the test file's stem where the judge knows it, and `presses` is the number of button presses an interactive problem's grader counted; both are `null` otherwise.

`score` counts the hidden tests that passed, `maxScore` the points those hidden tests are worth.
Public tests are worth nothing.
`compileMessage` carries the compiler's words for a `compilation_error`, and a readable reason for an `internal_error`.

## Failure and shutdown

A crash while judging one submission becomes an `internal_error` result for that submission and does not kill the service.

`SIGINT` and `SIGTERM` stop the machine accepting new work.
Running jobs are given a grace period to finish; whatever is still going is marked `internal_error`, the scratch root is emptied and the process exits 0.
A submission left `internal_error` this way is the app's to retry.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `SERVICE_KEY` | none | The shared key. Unset means the machine answers only `/health`. |
| `CHECKER_BIND` | `127.0.0.1` | The address the service listens on. The default keeps it off the internet. |
| `CHECKER_PORT` | `8080` | The port the service listens on. |
| `CHECKER_CAPACITY` | `2` | How many submissions this machine judges at once. |
| `PROBLEM_PACKAGES_PATH` | `/problems` | Where the problem packages live on this machine. |
| `CHECKER_SCRATCH_PATH` | `/tmp/online-judge` | Where a job's scratch directory is made and deleted. |
| `CHECKER_RESULT_TTL_SECONDS` | `900` | How long a finished result stays readable. |
| `CHECKER_SHUTDOWN_GRACE_SECONDS` | `30` | How long a running job may take to finish while stopping. |
| `CHECKER_JUDGE` | `bwrap:run_judge` | The judge behind the seam, as `module:function`. |
| `CHECKER_LOG_LEVEL` | `INFO` | How much the service says. |

The sandbox reads its own settings - `JUDGE_SANDBOX`, `BWRAP_PATH`, `CGROUP_ROOT`, `PYTHON_PATH` - and `checkers/README.md` documents those.

No host name, port, path or key is written into the source.

## The judging seam

The service knows one function, resolved from `CHECKER_JUDGE` the first time a submission is judged:

```python
run_judge(request, *, packages_path: Path, scratch_path: Path) -> report
```

- `request` carries `submission_id`, `problem_slug`, `package_directory`, `language` and `source_code`.
- `scratch_path` is a fresh empty directory for this job alone, deleted when the job ends either way.
- `packages_path` is `PROBLEM_PACKAGES_PATH`; the judge reads `packages_path/<package_directory>/` itself.
- The report carries `status`, `score`, `max_score`, `compile_message`, `max_cpu_ms`, `max_memory_kb` and `tests`, each row carrying `ordinal`, `visibility`, `verdict`, `passed`, `points_awarded`, `message`, `actual_output`, `time_ms`, `memory_kb` and optionally `name` and `presses`.

`common.contract.FinalReport` is that shape, and a judge may answer with its own equivalent object: `common.judging.coerce_report` reads it by attribute.
Anything the judge raises becomes an `internal_error` for that submission.
