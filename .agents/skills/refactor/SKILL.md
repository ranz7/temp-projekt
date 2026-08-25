---
name: refactor
description: User-invoked refactor lane — scoped argument → task split → delegated refactor → before/after PR → babysit to merge.
disable-model-invocation: true
argument-hint: <scope + kind of refactor>
---

**Start on today's `main`** - `git fetch origin main`, then branch from it, or merge it into a branch already carrying this lane's work (`resolving-merge-conflicts` if it stops). A lane begun on a stale base hands its conflicts to the human.

Refactor inside the argument's boundary — it names what to touch and what kind of refactor; there is no spec phase. Judge every change against performance and the repo's own rules (root + per-dir CLAUDE.md, `.cursor/rules/`). Behaviour stays identical: existing tests are the guard, green before and after; add a test only where a touched seam had none.

1. **Tasks** — split the scoped refactor straight into the `implement-spec` matrix (its steps 1–2), task names under 40 words. Every task stays inside the argument's scope and kind.
2. **Choose** — one question: Best value, Best results, or edit tasks first (`model-pick` owns both columns; the answer sets the path for the whole run). Last user input of the loop.
3. **Refactor** — `implement-spec` dispatch + review with the feature-loop deltas: root reviews each result against scope, repo rules, and performance; a defect goes back to the same worker until it passes; a finished worker commits only its own files — conventional title a few words, body under 40.
4. **PR** — no evidence page. `algo-git-pr` with bullets under 40 words each stating how it was → how it is now, plus Risk Assessment and the suggested human-review spots.
5. **Babysit to merge** — `algo-git-pr` fires it; the lane ends when that loop does, not when the PR appears.
