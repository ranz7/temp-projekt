---
name: resolving-merge-conflicts
description: Use when a git merge, rebase, or cherry-pick has stopped on conflicts and the working tree contains conflict markers — including multi-commit rebases onto main in this monorepo. Also use when the user says "resolve conflicts", "fix the merge", or a pull/rebase left conflicted files.
---

1. **See the current state** of the merge/rebase. Check git history (`git status`, `git log --oneline --left-right --merge`, `git diff`), and read the conflicting files whole — not just the marker hunks.

2. **Find the primary sources** for each conflict. Understand deeply why each side was changed, and what the original intent was. Read the commit messages of both sides (`git log -p <file>`); this repo squash-merges PRs, so the `(#NNN)` in a commit subject leads to the PR — `gh pr view NNN` — and from there to any linked issue or plan. A conflict is two intents colliding, and you cannot resolve intents you haven't read.

3. **Resolve each hunk by choosing between intents, not between texts.** Preserve both intents where possible. Where they are incompatible, pick the one matching the merge's stated goal and note the trade-off for the user. Do **not** invent new behaviour that neither side had. Always resolve; **never `--abort`** — an aborted merge is the task abandoned, not completed.

4. **Discover the project's automated checks and run them.** In this repo the baseline is `bun run typecheck`, then `bun run test`, then `bun run lint` (plus `bun run test:integration` when backend modules were touched — needs `bun run db:up`). If the conflicts touched areas with their own checks, look in the root `package.json` / `turbo.json` scripts for more. Fix anything the merge broke.

5. **Finish the merge/rebase.** Stage everything and commit (`git commit` for a merge, `git rebase --continue` for a rebase). If rebasing, keep going until **all** commits are rebased — conflicts often recur on later commits; resolving one stop and leaving the rebase half-done is not finishing.
