---
name: write-spec
description: Use when feature work still has open product decisions or the user asks for a spec. Not for bugfixes with a repro, already-locked implement requests, or writing an implementation plan.
---

Write a *tight* *spec* for the implementing agent. Sole job: kill *ambiguity*.

## Steps

Questions come before the spec, always — never write bullets and then ask about them.

1. **Lane** — size the ask, say it in one word. The open decisions pick the lane, not the size of the diff:
   - *oneshot* — intent already unambiguous; zero question rounds, and that is binding. Wanting to ask anything means you sized it wrong: say so, re-label it standard, ask.
   - *standard* — a few open decisions; exactly one round.
   - *epic* — many coupled decisions; rounds over the frontier as in `grilling` until it is empty; model + effort via `model-pick` on the run's path, say the pick before round one.
2. **Facts** — read the code, per-dir CLAUDE.md, baza. Never ask what you can look up.
3. **Decisions** — the lane's rounds, before a single spec bullet is drafted: only unresolved product decisions, each with a recommended answer. Skip anything the codebase already decides. An answer that opens a new decision → follow-up inside the same round. A question a non-programmer cannot answer is not asked yet, it is rewritten; each answer option describes what the user will see or what becomes allowed, never how it is built.
4. **Write**, rounds closed, `.agents/specs/YYYY-MM-DD-HH.MM-<slug>.md` in English:

```markdown
# <name>

- <decision>
- <decision>
```

The spec *is* the job. Unstated how = the agent chooses. A bullet stays under 40 words. Done when deleting any line loses a product decision. No headings, rationale, file lists, architecture, tests, or tasks.

5. **Critics** — epic lane only: fan out 2–3 non-Claude models on the written spec file, in parallel, each in the lane `model-pick`'s harness mapping gives it — they hunt spec flaws and product ambiguity still open (`model-pick`'s critique row, Best value unless the user already asked for Best results; distinct vendors, Cursor ids from `--list-models`). A real finding reopens step 3 for that decision; noise dies here, unrelayed.
6. Show the path + the bullets. Wait. Confirm is the go signal: `implement-spec` (with the lane), same session.
