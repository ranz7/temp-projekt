---
name: algo-review-branch
description: Full review cycle for the current branch vs main — routes changed files to review-checklist dimensions and fans out isolated subagents. Saves findings as a plan file by default. Use --scope for single-module focus.
argument-hint: "[--scope <path>] [--no-plan]"
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git log:*), Bash(git status:*), Bash(git rev-parse:*), Bash(git merge-base:*), Bash(git show:*), Bash(ls:*), Bash(wc:*), Bash(bun:*), Bash(date:*), Write, Agent
disable-model-invocation: true
---

Do NOT make any edits to the codebase. Do NOT run tests. Do NOT stage. Do NOT push. Audit-only.

Parse `$ARGUMENTS`:
- `--scope <path>` — restrict diff to this path prefix
- `--no-plan` — print report to terminal only, do not write a plan file

## Steps

### 1. Preflight

```bash
git rev-parse --abbrev-ref HEAD
```

- If branch is `main` → abort: "Cannot review the main branch directly."

```bash
git status --short
```

- If dirty → abort: "Uncommitted changes detected. Commit or stash first."

```bash
git diff --name-only main...HEAD -- ${SCOPE_ARG_OR_EMPTY}
```

- If empty → exit: "No changes vs main."
- If >100 files → abort: "Diff too large (>100 files). Use `--scope <path>` or Anthropic managed Code Review (`@claude review` on a PR)."
- If >40 files → warn: "Large diff (>40 files). Consider narrowing with `--scope <path>`."

Collect for the report header:
```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
BASE_SHA=$(git merge-base main HEAD)
NOW=$(date '+%Y-%m-%d-%H.%M')
AUTHOR="$(git config user.name) <$(git config user.email)>"
```

### 2. Classify changed files

```bash
git diff --name-only main...HEAD -- ${SCOPE_ARG_OR_EMPTY}
```

Map to review dimensions using this routing table (compute union, spawn each dimension at most once; always include `code-review`). Each dimension is a checklist file under `.agents/skills/algo-review-branch/checklists/`:

| Path glob | Checklists |
|---|---|
| `packages/backend/src/database/migrations/*.sql` or `**/schema.ts` | `../algo-db-generate-migration/references/migration-safety-checklist.md` |
| `packages/backend/src/modules/**/endpoints/**/*.ts` or `**/router.ts` | `code-review` + `security` + `integration-test-coverage` |
| `packages/backend/src/**/*.ts` (non-endpoint) | `code-review` + `security` |
| `apps/*/src/app/**/route.ts` | `security` + `code-review` |
| `packages/design-system/src/**` | `web-design` + `accessibility` + `composition` |
| `apps/*/src/**/*.tsx` (non-design-system) | `react-performance` + `composition` + `accessibility` |
| `apps/*/src/**/*.ts` or `packages/shared/**/*.ts` (no JSX) | `code-review` |
| `Dockerfile`, `entrypoint.sh`, `infra/**/tasks/**/*.yml`, `infra/**/handlers/**/*.yml`, `infra/**/*.sh`, `infra/**/*.mjs`, `infra/**/*.js`, `infra/**/*.ts`, `infra/**/*.j2` | `code-review` + `security` |
| `package.json`, `next.config.*`, `.github/workflows/**`, other declarative `infra/**` | **Config — skip AI review, flag for human review** |
| Anything else | `code-review` (fallback) |

### 3. Mechanical gate (zero AI tokens)

For each changed `.ts` / `.tsx` file, parse every `db.delete(` / `db.update(` (or `trx.` variant) as an independent call chain and report any chain with no `.where(`:

```bash
WRITE_FILES=()
while IFS= read -r file; do WRITE_FILES+=("$file"); done \
  < <(git diff --diff-filter=ACMR --name-only main...HEAD -- '*.ts' '*.tsx')
if (( ${#WRITE_FILES[@]} )); then
  bun .agents/skills/algo-review-branch/scripts/check-bulk-writes.mjs "${WRITE_FILES[@]}"
fi
```

Inspect each `CHECK:` hit manually (multi-line chains) — a genuine `.delete()`/`.update()` without `.where()` is a **Critical** finding (CLAUDE.md Must-Never; no linter catches it).

### 4. Fan-out to subagents (parallel)

In a **single message**, spawn one `general-purpose` agent per selected dimension via the Agent tool, concurrently (up to 10 per batch).

Prompt template per dimension:

> Read `<absolute path to checklist file>` and audit ONLY these files against it: `<file list>`.
> Follow the checklist's output format exactly. Audit-only — make NO edits, run NO tests.
> Do not flag issues outside the listed files. Cap nitpicks/INFO at 5 total.

If the migration-safety dimension is in the set, spawn it first (sequential) — schema findings affect code review context.

Sub-agents are isolated — they do not inherit parent context. Pass everything needed in the prompt (checklist path + file list + branch/base SHA if useful).

### 5. Consolidate findings

1. **Dedupe** by `(file, line, rule)` — multiple dimensions flagging same item → merge, tag all sources.
2. **Severity escalation** — on conflict take the highest severity.
3. **Sort**: Critical → Important → Nitpicks.
4. **Cap nits**: max 5 per dimension.

### 6. Write plan (default) or print to terminal (--no-plan)

Build the report body:

```markdown
---
author: <AUTHOR>
last_modified: <NOW>
---

# Branch Review: `<BRANCH>`

**Date:** <YYYY-MM-DD>
**Base SHA:** `<BASE_SHA>`
**Dimensions run:** <list>
**Files reviewed:** <count>

---

## Todos

### Critical (must fix before merge)
- [ ] [<area>] `<file:line>` — <issue> → <fix>

### Important (should fix)
- [ ] ...

### Nitpicks (optional)
- [ ] ...

---

## Config files (human review needed)

- <list of package.json / workflow / Dockerfile changes, if any>
```

If all clean, write: `## Clean — no findings across all dimensions.` (no Todos section needed).

**Default (plan file):** write the report to:
`.claude/plans/<NOW>-review-<BRANCH-slugified>.md`

Where `<BRANCH-slugified>` replaces `/` and spaces with `-`, e.g. `refactor/my-feature` → `refactor-my-feature`.

Print the plan file path when done.

**With `--no-plan`:** print the report directly to terminal instead of writing a file.

Do NOT make any edits to the codebase. Wait for Radoslaw to choose what to fix.
