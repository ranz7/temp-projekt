---
name: diagnose
description: Disciplined diagnosis loop for hard bugs and performance regressions. Reproduce → minimise → hypothesise → instrument → fix → regression-test. Use when user says "diagnose this" / "debug this", reports a bug, says something is broken/throwing/failing, or describes a performance regression.
---

*Tight* *red* loop first. No hypothesis without a command you already ran that catches the user's exact symptom. Redact secrets (`<REDACTED>`); credentials stay in env.

1. **Loop** — one agent-runnable command, seconds, deterministic, asserts the user's symptom. Show invocation + redacted output. No loop → stop and ask for access, a HAR/log, or prod instrumentation.
2. **Minimise** — cut inputs until every remaining piece is load-bearing (remove one → green).
3. **Hypotheses** — 3–5 falsifiable, ranked. Format: if X then changing Y makes it disappear. Show the user; don't block if AFK.
4. **Instrument** — one variable. Tag logs `[DEBUG-xxxx]`. Three failed fixes → architecture (`improve-codebase-architecture`). Perf front-to-back → `algo-debug-performance`.
5. **Fix** — failing regression test at a *correct seam* (real call-site pattern) before the fix, when a seam exists. No seam is itself a finding.
6. **Cleanup** — original loop green, DEBUG tags gone (`grep`), throwaways deleted. State the winning hypothesis in the commit. Then: what would have prevented this?

Flakes: `references/condition-based-waiting.md`. Suite-only fail: `references/find-polluter.sh`. Human click: `scripts/hitl-loop.template.sh`.
