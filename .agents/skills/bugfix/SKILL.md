---
name: bugfix
description: User-invoked bugfix lane — fast or slow lane by difficulty → diagnose loop → fix + regression test → PR → babysit to merge.
disable-model-invocation: true
argument-hint: <bug description | repro | error>
---

**Start on today's `main`** - `git fetch origin main`, then branch from it, or merge it into a branch already carrying this lane's work (`resolving-merge-conflicts` if it stops). A lane begun on a stale base hands its conflicts to the human.

Fix one bug. Models are yours to pick, never a question here: `model-pick` on Best value, escalated a step on observed failure. Pick the lane yourself too and say it before starting:

- **fast** — repo context plus the user's input localises the cause. Straight into `diagnose`.
- **slow** — cause unclear, or the evidence lives outside the repo. `diagnose`, plus in parallel: second opinions on the probable cause (2–3 non-Claude models per `model-pick`, each through its lane - `codex` or `cursor-agent`), and the production MCPs where relevant — prod DB read queries, HyperDX logs and traces. What confirms folds into the hypothesis ranking; what doesn't, dies there.

Then, either lane:

1. **Fix** — diagnose's loop to the end: failing regression test at a correct seam before the fix, cleanup, winning hypothesis in the commit.
2. **PR** — `algo-git-pr`: bullets under 40 words each (symptom → cause → fix), Risk Assessment, suggested human-review spots; evidence links = the regression test and the red→green run.
3. **Babysit to merge** — `algo-git-pr` fires it; the lane ends when that loop does, not when the PR appears.
