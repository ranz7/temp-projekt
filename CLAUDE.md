# CLAUDE.md

Single source for all agents — `AGENTS.md` points here. Skills: canonical `.agents/skills/`, stubs `.claude/skills/`, authoring `.agents/skills/README.md`. Editing skills or any agent-facing doc: read `.agents/skills/writing-for-agents/SKILL.md` first.

## What this is

New product workspace. App code lives at the repo root. `.ai/` is gitignored scratch: checked-out copies of other repos, read while porting - not the app, not a place to commit.

Reference clones today:

| Clone | What it is |
| --- | --- |
| `.ai/ksi-internships-scalable-backend` | Full-stack Online Judge: Next.js + FastAPI/Beanie/Mongo + native Linux judge |
| `.ai/ksi-internship-scalable-backend` | Earlier internship fork (frontend / backend / checker) |
| `.ai/scalable-backend` | Three HTTP apps: frontend :3000, backend :8000, sprawdzarka :8002 + OIOIOI |

Read a clone's `README.md` (and `AGENTS/` if present) before copying a pattern from it. Never treat `.ai` as the working tree unless the user names that clone.

## Lanes

Feature / bugfix / refactor / research run as user-invoked commands — `/feature`, `/bugfix`, `/refactor`, `/research` (canonical `.agents/skills/<name>/SKILL.md`); they fire only when typed.

Human sits in two seats: confirm the spec, final review - human merges (squash).

**Every human-facing output - chat sections, reports, matrices, PR bodies - in ≤40 words per section/ bullet point.** Terse: substance stays whole, fluff dies; fragments OK.

**Plain language.** Say what happens to a user, a problem, a submission; symbol names come after, in brackets, only where they help a human find the spot. Verdicts and reviews walk one concrete case: how it behaves today, how it behaves after. A finding a non-programmer cannot weigh is not reported yet. A question a non-programmer cannot answer is not asked yet, it is rewritten; answer options describe what the user will see or what becomes allowed, never how it is built.

## Stack

Not locked until the app exists at repo root. Prior art in `.ai/` is FastAPI + Next.js + a judge process (Mongo or OIOIOI), not Kraken's tRPC/Drizzle stack.

When the app lands, put commands and architecture in this file and in per-directory `CLAUDE.md` files. Until then: follow the clone's README for how that reference runs; do not invent a second stack.

## Commands

App scripts live in the app's own README / package manager once the tree exists.

Agents never start a dev server on the default port - the human's own server usually owns 3000/8000 and you would screenshot their tree, not yours. Pick a random port in 3200-3899 (`PORT=$((3200 + RANDOM % 700))`), poll it until it answers, and use that URL everywhere downstream.

## Must Never

- **Never commit directly to `main`** — use PRs
- Never commit `.ai/`, `.env`, secrets, or `evidence/`
- Never hand-edit generated files - regenerate via their scripts
- Never use em dashes; plain `-` everywhere, all output
- Never add an agent name as co-author or a session trailer to commit messages
- Never use `any`, `as` assertions, or `@ts-ignore` / `# type: ignore` without justification
- Named exports only in TypeScript — no default exports. `type`, not `interface`

## Engineering Standards

- Technical decisions weigh quality, simplicity, robustness, scalability, long-term maintainability - development cost carries little weight.
- A bugfix starts by reproducing the bug end-to-end, the way the end user hits it; minimise only after the real problem is confirmed.
- E2E product testing is pixel-picky: UI that clearly looks off gets fixed in passing, even when off-task.
- Same bar for hygiene: a lint error, failing test, or flaky test you encounter gets fixed, even when it is not yours.
- Long Markdown files: one full sentence per physical line; normal Markdown structure otherwise.

## GitHub

Everything on GitHub and in the codebase is English — issues, PRs, comments, commits; chat should stay Polish. Squash-merge to `main`; merge over rebase on shared branches; branch prefixes `feat/ fix/ refactor/ chore/ perf/ docs/` (no issue numbers). PR body: `## Risk Assessment`, exactly one `Low`/`Medium`/`High` + rationale. GitHub Actions is the gate — local mirror only via `/fix-before-git-pr` when the user asks.

## Architecture

Repo root is the app. `.ai/<name>/` is a read-only reference checkout of another git repo.

**Full specs (when they exist):**
- Product / agent loop → this file
- Skills catalog → `.agents/skills/README.md`
- Confirmed feature specs → `.agents/specs/`
- Research reports → `.agents/research/`
- Reference clone instructions → that clone's `README.md` and `AGENTS/`

## File and Directory Naming

Only `a-z`, `0-9`, `-`, `_`, `.`. Timestamped files (specs, research): `YYYY-MM-DD-HH.MM-description.md`.

## Agent Context

- `algo-*` skills were written for the AlgoAcademy/Kraken tRPC+Drizzle layout. Invoke them only when this repo actually has that layout; otherwise follow the code that is here.
- Format / lint / typecheck before finishing UI/API work when the app has those scripts - not a hard gate until CI exists.
