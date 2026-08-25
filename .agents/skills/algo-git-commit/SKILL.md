---
name: algo-git-commit
description: Create a Conventional Commit from staged changes (filters TODO/console.log)
allowed-tools: Bash(git add:*), Bash(git commit:*), Bash(git diff:*), Bash(git status:*)
model: haiku
---

1. `git status --short` — nothing staged → stop.
2. `git diff --cached`. Smell-scan: `TODO`, `FIXME`, `console.log`, `console.error`, `debugger`, `eslint-disable`, commented-out blocks. Any hit → ask before commit.
3. Title `type(scope): subject` ≤72. type ∈ feat|fix|refactor|docs|test|chore|style|perf. scope = module or frontend area. Body only if *why* is not in the diff. `$ARGUMENTS` is a hint. No Claude footer.

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <subject>

<optional body>
EOF
)"
```

4. `git status` to confirm.
