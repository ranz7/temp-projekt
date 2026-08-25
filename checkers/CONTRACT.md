# Checker worker HTTP contract

This document defines contract version 1 between the Python checker workers and the Next.js app.
Every JSON request and response payload contains `"contractVersion": 1`.
A different version must be rejected instead of being interpreted as version 1.

## Transport and authentication

Workers call the Next.js app over HTTP.
Every endpoint in this document except health endpoints requires `X-Service-Key: <SERVICE_KEY>`.
No checker request uses cookies.
A missing or incorrect key returns `401 Unauthorized`.
`GET /api/health` and `GET /api/ready` require no key.

Unless stated otherwise, successful checker calls return `200 OK` with:

```json
{ "contractVersion": 1 }
```

## Claim work

`POST /api/internal/checker/claim` asks for one submission matching a worker's supported languages.

Request:

```json
{
  "contractVersion": 1,
  "workerId": "bwrap-1",
  "languages": ["python"]
}
```

`languages` is a non-empty list containing `python`, `cpp`, or both.
When no matching submission is ready, the response is:

```json
{
  "contractVersion": 1,
  "job": null
}
```

When work is available, the response contains one leased job:

```json
{
  "contractVersion": 1,
  "job": {
    "submissionId": "0198df77-9122-7000-8000-000000000001",
    "claimId": "0198df77-9122-7000-8000-000000000002",
    "problemSlug": "cf-4-A",
    "packageDirectory": "cf-4-A",
    "language": "python",
    "sourceCode": "print('YES')\n",
    "timeLimitMs": 1000,
    "memoryLimitMb": 64,
    "checkerType": "token",
    "checkerPath": null,
    "tests": [
      {
        "problemTestId": "0198df77-9122-7000-8000-000000000003",
        "ordinal": 1,
        "visibility": "public",
        "points": 0,
        "input": "8\n",
        "expectedOutput": "YES\n"
      },
      {
        "problemTestId": "0198df77-9122-7000-8000-000000000004",
        "ordinal": 2,
        "visibility": "hidden",
        "points": 1,
        "inputFile": "002.in",
        "outputFile": "002.out"
      }
    ]
  }
}
```

Tests are ordered by ascending `ordinal`.
For `checkerType: "custom"`, `checkerPath` is the checker script path relative to the package directory.
For `checkerType: "token"`, `checkerPath` is `null`.
Public tests contain inline `input` and `expectedOutput`.
Hidden tests contain only `inputFile` and `outputFile`, relative to the package's `tests` directory.
Hidden input and output content is never sent over HTTP; the worker reads the named files from its mounted package filesystem.

## Heartbeat

`POST /api/internal/checker/heartbeat` extends the lease identified by both IDs.

```json
{
  "contractVersion": 1,
  "submissionId": "0198df77-9122-7000-8000-000000000001",
  "claimId": "0198df77-9122-7000-8000-000000000002"
}
```

## Report progress or a result

`POST /api/internal/checker/result` reports either progress or the final result for the current claim.
A progress report has no result fields:

```json
{
  "contractVersion": 1,
  "submissionId": "0198df77-9122-7000-8000-000000000001",
  "claimId": "0198df77-9122-7000-8000-000000000002",
  "status": "running"
}
```

A final report uses `accepted`, `wrong_answer`, `time_limit`, `memory_limit`, `runtime_error`, `compilation_error`, or `internal_error`:

```json
{
  "contractVersion": 1,
  "submissionId": "0198df77-9122-7000-8000-000000000001",
  "claimId": "0198df77-9122-7000-8000-000000000002",
  "status": "accepted",
  "score": 1,
  "maxScore": 1,
  "compileMessage": null,
  "maxCpuMs": 12,
  "maxMemoryKb": 4096,
  "tests": [
    {
      "problemTestId": "0198df77-9122-7000-8000-000000000003",
      "ordinal": 1,
      "verdict": "passed",
      "passed": true,
      "pointsAwarded": 0,
      "message": null,
      "actualOutput": "YES\n",
      "timeMs": 10,
      "memoryKb": 4096
    }
  ]
}
```

Per-test `verdict` is `passed`, `wrong_answer`, `time_limit`, `memory_limit`, or `runtime_error`.
`compileMessage`, per-test `message`, and per-test `actualOutput` are strings or `null`.
A compilation error has its compiler diagnostic in `compileMessage` and an empty `tests` list.
Workers run every test, so other final reports contain the complete ordered test list.

## Release work

`POST /api/internal/checker/release` gives up a claim when the worker cannot judge it now, for example because OIOIOI is unreachable.

```json
{
  "contractVersion": 1,
  "submissionId": "0198df77-9122-7000-8000-000000000001",
  "claimId": "0198df77-9122-7000-8000-000000000002",
  "reason": "OIOIOI is unreachable"
}
```

The app returns the submission to the queue without consuming one of its three judging attempts.

## Idempotency and fencing

The app applies heartbeat, result, and release only to the active `claimId` for the named submission.
A submission that already has a final status ignores every later heartbeat, result, or release, including a duplicate final report.
The app still returns `200 OK` and changes nothing.

## Environment variables

### Next.js app

- `DATABASE_URL`: PostgreSQL connection URL; required, with no production default.
- `REDIS_URL`: Redis connection URL used to wake workers; defaults to `redis://127.0.0.1:6379` for local development.
- `SERVICE_KEY`: shared value expected in `X-Service-Key`; required, with no production default.
- `SUBMISSION_LEASE_SECONDS`: lease duration extended by heartbeat; defaults to `60`.
- `SUBMISSION_MAX_ATTEMPTS`: expired-lease attempt limit; defaults to `3`.
- `PROBLEM_PACKAGES_PATH`: app-side root containing problem packages for seeding; defaults to `./problems`.

### Both checker workers

- `APP_URL`: base URL of the Next.js app; defaults to `http://127.0.0.1:3000` for local development.
- `SERVICE_KEY`: shared value sent in `X-Service-Key`; required and identical to the app value.
- `WORKER_ID`: stable unique worker identifier; defaults to the container hostname.
- `PROBLEM_PACKAGES_PATH`: mounted root containing the same problem packages on every replica; defaults to `/problems`.
- `CHECKER_POLL_SECONDS`: delay after a no-work response; defaults to `1`.
- `CHECKER_HEARTBEAT_SECONDS`: heartbeat interval, shorter than the lease; defaults to `20`.
- `CHECKER_SCRATCH_PATH`: per-job temporary workspace root; defaults to `/tmp/online-judge`.
- `CHECKER_HEALTH_PORT`: worker health server port; defaults to `8080`.

### C++ checker only

- `OIOIOI_URL`: base URL of the external OIOIOI service; required.
- `OIOIOI_TOKEN`: OIOIOI API token; required.
- `OIOIOI_CONTEST_ID`: OIOIOI contest identifier; required.
- `OIOIOI_POLL_SECONDS`: result polling interval; defaults to `2`.
- `OIOIOI_REQUEST_TIMEOUT_SECONDS`: HTTP request timeout; defaults to `10`.

### Sandboxed Python checker only

- `BWRAP_PATH`: bubblewrap executable; defaults to `/usr/bin/bwrap`.
- `CGROUP_ROOT`: writable cgroup v2 root; defaults to `/sys/fs/cgroup`.
- `PYTHON_PATH`: Python executable used for submissions; defaults to `/usr/bin/python3`.
