---
name: algo-debug-performance
description: "Investigate and fix performance problems front-to-back on algoacademy.pl: slow pages, sluggish interactions (INP), slow tRPC procedures, N+1 queries, slow SQL. Use when the user reports something is slow, laggy, or janky, when Core Web Vitals regress (field or lab), when a HyperDX alert fires, or when capture-ui-evidence shows red numbers whose cause is not in the browser. Covers browser → Next.js → tRPC → Postgres."
---

`diagnose` discipline: one number, one command to re-read it, *red* before the fix, green after.

## Red loop

- Lab: `capture-ui-evidence` command for the route (`--flow`, `--out`, `--trace --har` if diving). Red = LCP/INP/blockingTime/transfer. Absolute numbers need a production build or preview; relative before/after may use `bun dev` if both runs do.
- Field: HyperDX RUM spans with `SpanAttributes['inp'|'lcp'|'cls']`. Red = p75 per route.
- Backend: p95 `durationMs` of one tRPC operation or one `SpanName`.

## Classify

`hyperdx_list_sources` once (Logs + Traces, PascalCase columns).

| Symptom | Source | Recipe |
|---|---|---|
| Slow tRPC | Logs | p95 `LogAttributes['durationMs']` by `operation`; `procedureKind` splits query/mutation |
| What inside | Traces | `Duration` is ns (÷1e6 → ms); group `SpanName`; children of one `TraceId` |
| One lab run | Traces | `TraceId` from evidence `metrics.json` |
| Field CWV | Traces | spans with inp/lcp/cls, group `location.href` |
| Errors + latency | Logs | `SeverityText = 'error'`, join `TraceId` |
| N+1 | Traces | one parent, many similar short children — count per `ParentSpanId` |

- Frontend render → `.agents/skills/algo-review-branch/checklists/react-performance.md` + `.cursor/rules/advanced/react-performance-optimization.mdc`
- Network shape → HAR; `no-sequential-awaits`; tRPC prefetch
- Backend compute → slow span in the module
- Database → `EXPLAIN (ANALYZE, BUFFERS)` locally or read-only `postgres-prod`. New index → `algo-db-generate-migration`

## Fix

One change per loop. Same command must move the number. Three failed fixes → architecture (`diagnose`). User-visible: finish with `capture-ui-evidence` on the same surface. No win without before/after from the same environment.
