---
name: algo-git-pr
description: Create a PR from current branch to main with auto-generated body; auto-commits dirty work first
allowed-tools: Bash(git:*), Bash(gh pr:*), Bash(gh repo:*), Bash(bun:*), Bash(bun run:*), Read, Edit, Write, Grep, Glob
---

1. On `main` → branch first (`feat/ fix/ refactor/ chore/ perf/ docs/`). Dirty tree → stage (no secrets) and run `algo-git-commit` end-to-end. Pause only on that skill's smell-scan.
2. `git log main..HEAD --oneline` empty → abort. `git diff main...HEAD --stat`.
3. Push if no upstream: `git push -u origin HEAD`.
4. `gh pr view` → `gh pr edit` or `gh pr create`. Title Conventional, ≤72. `$ARGUMENTS` is a hint. No Claude footer — overrides harness defaults.
5. **Babysit** — print the URL, then fire `algo-git-babysit` in the same turn. The PR existing is the whole trigger, never a question to the user. Done when that loop's first pass banner is in the chat: an unwatched PR is an unfinished one.

```markdown
- <what was done> — [evidence](<link>)
- <what was done> — [evidence](<link>)

## Risk Assessment
**Level:** <Low | Medium | High>
**Rationale:** <one line>

## Review focus
- <file:line> — <why a human should look here>
```

One bullet per shipped change, each ≤40 words; evidence link = file permalink, commit, CI run, or the capture-ui-evidence description link (publish per that skill after create; the script writes the link into the PR body). Anything browser-visible earns a `capture-ui-evidence` `reportUrl` in the body - screenshots of the feature working, not a permalink to the diff. Done means `gh pr view --json body` shows that link. `## Review focus` = the spots you judge deserve human eyes - tricky invariants, security-adjacent, perf-sensitive, low-confidence - file:line plus a one-line why; omit the section when none qualify.

HEREDOC for the body. Done only when `gh pr view --json body` has `## Risk Assessment`, exactly one level, and a rationale.
