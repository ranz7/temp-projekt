# CLAUDE.md

Single source for all agents — `AGENTS.md` points here. Skills: canonical `.agents/skills/`, stubs `.claude/skills/`, authoring `.agents/skills/README.md`. Editing skills or any agent-facing doc: read `.agents/skills/writing-for-agents/SKILL.md` first.

## What this is

An online judge: people submit Python or C++ solutions to four programming problems, watch them being judged, and compete in a global ranking.
The app runs on one Next.js server that owns Postgres; checker machines run separate services.
Both Python and C++ are judged inside a bubblewrap sandbox on the checker machines.
A loop runner process syncs machines, hands waiting submissions to machines that are online and available, and collects results; without it running, submissions sit in the queue forever.

## Lanes

Feature / bugfix / refactor / research run as user-invoked commands — `/feature`, `/bugfix`, `/refactor`, `/research` (canonical `.agents/skills/<name>/SKILL.md`); they fire only when typed.

Human sits in two seats: confirm the spec, final review - human merges (squash).

**Every human-facing output - chat sections, reports, matrices, PR bodies - in ≤40 words per section/ bullet point.** Terse: substance stays whole, fluff dies; fragments OK.

**Plain language.** Say what happens to a user, a note, a page; symbol names come after, in brackets, only where they help a human find the spot. Verdicts and reviews walk one concrete case: how it behaves today, how it behaves after. A finding a non-programmer cannot weigh is not reported yet. A question a non-programmer cannot answer is not asked yet, it is rewritten; answer options describe what the user will see or what becomes allowed, never how it is built.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack) — single project
- **Language**: TypeScript strict mode
- **API**: tRPC v11, superjson
- **Database**: PostgreSQL 17 (Docker) + Drizzle ORM
- **Loop runner**: Python, runs in the app container, dispatches work and collects results
- **Testing**: Vitest — unit + integration against a real database
- **Frontend**: React 19, Tailwind v4
- **Tooling**: Biome, bun

## Commands

```bash
bun dev                     # Next.js dev (Turbopack)
bun run build               # Production build
bun run lint / lint:fix     # Biome check / autofix
bun run format              # Biome format --write
bun run typecheck           # tsc --noEmit
bun run db:up / db:down     # Start / stop local Postgres (Docker)
bun run db:migrate          # Apply migrations
bun run db:seed             # Seed the four problems if empty
bun run stack:up            # docker compose up -d --build
bun run stack:down          # Stop all containers
bun run test                # Unit
bun run test:integration    # Integration (tRPC caller + real DB `projekt_test`)
```

Agents never start a dev server on the default port - the human's own `bun dev` usually owns 3000 and you would screenshot their tree, not yours. Pick a random port in 3200-3899 (`PORT=$((3200 + RANDOM % 700))`), poll it until it answers, and use that URL everywhere downstream.

## Must Never

- **Never commit directly to `main`** — use PRs
- **Every `db.delete()` and `db.update()` MUST have `.where()`** — no linter catches this
- Never edit a file in `src/backend/database/migrations/` — immutable once generated
- Never hand-edit generated files - regenerate via their scripts
- Never use em dashes; plain `-` everywhere, all output
- Never add an agent name as co-author or a session trailer to commit messages
- Never use `any`, `as` assertions, or `@ts-ignore` / `# type: ignore` without justification
- Never mock the database in tests — real DB + seed
- **Never invent entity UUIDs** (`crypto.randomUUID()` and friends) — PKs come from Postgres `uuid_generate_v7()`; omit the id on create
- Named exports only — no default exports except Next.js special files (`page`, `layout`, `loading`, `error`, `route`). `type`, not `interface`

## Engineering Standards

- Technical decisions weigh quality, simplicity, robustness, scalability, long-term maintainability - development cost carries little weight.
- A bugfix starts by reproducing the bug end-to-end, the way the end user hits it; minimise only after the real problem is confirmed.
- E2E product testing is pixel-picky: UI that clearly looks off gets fixed in passing, even when off-task.
- Same bar for hygiene: a lint error, failing test, or flaky test you encounter gets fixed, even when it is not yours.
- Long Markdown files: one full sentence per physical line; normal Markdown structure otherwise.

## GitHub

Everything on GitHub and in the codebase is English — issues, PRs, comments, commits; chat should stay Polish. Squash-merge to `main`; merge over rebase on shared branches; branch prefixes `feat/ fix/ refactor/ chore/ perf/ docs/` (no issue numbers). PR body: `## Risk Assessment`, exactly one `Low`/`Medium`/`High` + rationale. GitHub Actions is the gate — local mirror only via `/fix-before-git-pr` when the user asks.

## Architecture

```
src/
├── app/                 App Router — web UI + HTTP handlers
│   ├── page.tsx         problems list with recent submissions
│   ├── problems/        problem detail + submit editor
│   ├── ranking/         global and per-problem rankings
│   ├── admin/           operator panel: machines, batch submit
│   ├── submissions/     submission detail (my submissions)
│   ├── _components/     shared UI components
│   ├── _trpc/           client, RSC caller, query client
│   └── api/trpc/        tRPC handler
├── shared/              environment helpers
└── backend/
    ├── appRouter.ts     { account, task, submission, ranking, machine, benchmark }
    ├── trpc/            init, context, publicProcedure
    ├── database/        db, schema barrel, migrations, seed
    └── modules/
        ├── account/     username login + session
        ├── task/        problem list + detail reads
        ├── submission/  submit, judge, list, queued submissions
        ├── ranking/     global + per-problem rankings
        ├── machine/     machine registry, health, dispatching
        └── benchmark/   admin batch submission
```

Path aliases: `@backend/*` → `src/backend/*`, `@shared/*` → `src/shared/*`, `@/*` → `src/*`.

## Deployables

**Web server** (`deploy/web/Dockerfile`):
- Next.js app: UI, tRPC API, admin panel, login session.
- Owns Postgres 17.
- One instance per environment.
- Loop runner (in same container): syncs machines, dispatches work, collects results.

**Loop runner** (same image as web):
- One per environment; without it, submissions stay queued forever.
- Polls machines for health, hands waiting submissions to available machines, reads back results.
- Runs three internal loops: health (every 5 seconds), dispatch (every 1 second), collect (every 2 seconds).

**Checker machines** (`deploy/checker/Dockerfile.bwrap`):
- One service per machine, stateless, reaches app through SSH tunnel only.
- Python service with bubblewrap: judges Python and C++ submissions inside sandbox with CPU and memory limits.
- Answers health checks (no key needed), judge requests, and result reads (both key-protected).
- No test data in the image: reads from disk during judging.
- Scratch directory deleted after each job.

## Language support

- **Python**: every checker judges Python code inside bubblewrap sandbox with CPU and memory limits.
- **C++**: every checker compiles and runs C++ code in the same sandbox.
- **Other**: refused at submit time with a validation error.

**Full specs:**
- Backend conventions, DB rules, testing → `src/backend/CLAUDE.md`
- Operator UI, App Router, React conventions → `src/app/CLAUDE.md`
- Confirmed feature specs → `.agents/specs/`

## File and Directory Naming

Only `a-z`, `0-9`, `-`, `_`, `.`. Endpoint directories are kebab-case verb-noun (`list-notes`). Migrations are `<idx>__<module>__<action>__<subject>.sql`. Timestamped files (specs, research): `YYYY-MM-DD-HH.MM-description.md`.

## Environment variables

See the environment variable table in `README.md`.
Settings come from `.env` (root, for local dev and Docker Compose) or `deploy/<service>/.env` (per-service, production), layered over `.env.example`.
`SERVICE_KEY` must match between app and all checkers byte-for-byte; mismatches silently refuse every call.
All secrets stay in `.env` (gitignored), never in `.env.example`.

## Agent Context

- tRPC cache: `prefetch` / `prefetchAwaited` + `useQuery` via `useTRPC()` from `@/app/_trpc/config`.
- `bun run format` / `lint` / `typecheck` before finishing UI/API work when useful - not a hard gate.
- `bun run lint:fix` skips unsafe fixes - remove unused imports manually and re-run.
