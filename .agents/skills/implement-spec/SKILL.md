---
name: implement-spec
description: Use when a confirmed spec in .agents/specs/ must become code — when the user says "implement the spec", or when picking up a spec locked in another session.
---

Ship a confirmed spec. The spec is the contract: unstated how = you choose; scope = its bullets, nothing more. New product ambiguity → `patch-spec`, then code.

## Steps

1. **Groups** — split the work into small tasks in ordered groups: group N+1 depends on N; tasks inside a group touch disjoint files. Same tree — worktrees only if the user asks.
2. **Matrix** — render it in chat as a Markdown table, one row per task, columns `group · task · files · Best value · Best results`. Both model columns come from `model-pick` and name model + effort per task, so the two paths are comparable at a glance. Then ask, every lane including oneshot — change tasks / go Best value / go Best results — and wait. The answer is the run's path for every later dispatch too, support roles included; silence means Best value.
3. **Dispatch** — always to workers, never implement in the root and never ask whether to delegate. One worker per task: the path's row in `model-pick` names the model, external ids go through `codex` or `cursor-agent` per `model-pick`'s harness mapping, write ask spelled out (`-s workspace-write` / `--force` — implement-spec carries it as standing), groups in order, a group's tasks as parallel background runs. Prompt = spec path + task + file list; workers inherit nothing. Take `model-pick`'s fallback when a model is unreachable, and say so.
4. **Review** — root holds the spec, workers hold the editor. Check each result against the spec and module boundaries before the next group starts; a defect goes back with the finding — re-dispatch the task with the finding in the prompt (continue the same Claude subagent where the harness allows).
5. **Verify** — root runs it: every spec bullet demonstrably works — test where a seam exists (add missing ones), `capture-ui-evidence` for UI, `diagnose` on red. Green typecheck, lint and tests are the floor, not news.
6. **Evidence PR** — fire it, zero questions: `algo-git-pr`, body carrying the evidence link (`reportUrl` from the `capture-ui-evidence` publish) as the proof the feature works. A UI change whose PR body has no evidence link is unfinished.
7. **Babysit to merge** — `algo-git-pr` fires it; the lane ends when that loop does, not when the PR appears.
8. **Report** — the matrix question in step 2 was the user's last input; everything after it lands in one chat block of at most 5 bullets: what shipped, the PR link, and what the human must decide (skipped bullets, red left standing, a rule you had to bend). File lists, per-file detail, tool-by-tool verification and environment workarounds stay out. The block covers the work up to the PR only: each babysit pass carries its own report beside it, per `algo-git-babysit`, so the loop stays visible while it runs.
