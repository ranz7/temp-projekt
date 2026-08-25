---
name: fix-before-git-pr
description: Optional local CI mirror — format, lint, typecheck, tests, build; run only when the user asks
allowed-tools: Bash(bun:*), Bash(bun run:*), Read, Edit, Write, Grep, Glob
---

Optional local mirror of `.github/workflows/ci.yml`. **Invoke only when the user explicitly asks** (e.g. `/fix-before-git-pr`). Not required before push or `/algo-git-pr` — GitHub Actions CI is the gate.

## Command sequence

Run from repo root, **in order**. Stop on first hard failure until fixed; then continue.

```bash
bun run format
bun run lint:fix
bun run lint
bun run format:check
bun run generate:theme-css -- --check
bun run boundaries
bun run boundaries:modules
bun run typecheck
bun run test
bun run build
```

When backend/schema/DB-related changes are in the branch (or user asks for full CI):

```bash
bun run test:integration
```

Use `$ARGUMENTS` as an optional typecheck scope hint:

| Scope | Typecheck command |
|-------|-------------------|
| `backend` | `bun run typecheck:backend` |
| `packages` | `bun run typecheck:packages` |
| `mobile` | `bun run typecheck:mobile` |
| (default) | `bun run typecheck` |

Always run format/lint/boundaries/test/build on the whole repo (not scoped).

## On failure

1. **lint** — `lint:fix` only applies safe fixes. Remove unused imports / fix Biome manually, re-run `bun run lint`.
2. **typecheck / test / build** — fix manually, re-run the failed command.
3. Loop: fix → re-run failed step(s) → until all required steps exit 0.
4. If format/lint:fix modified files → leave them for the user/commit flow (do not open PR on a dirty tree without committing).

## Output

When done, report:

- Which commands ran and exit codes
- Files changed by format/lint:fix or manual fixes
- Any errors left unfixed (file + line)

**Do not claim clean** unless fresh command output shows exit 0 for every required step.
