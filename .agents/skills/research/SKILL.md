---
name: research
description: User-invoked research lane — relentless scoping interview → outline → executed report in .agents/research/.
disable-model-invocation: true
argument-hint: <topic>
---

**Start on today's `main`** - `git fetch origin main` and bring the working branch up to it before reading any code. A report written against a stale tree describes code that has already moved.

The interview closes before any search runs. Reports live in `.agents/research/`. Models are yours to pick, never a question here: `model-pick` on Best value, escalated a step on observed failure.

1. **Interview** — unlimited rounds, every run (`grilling` discipline): what exactly is being researched and why now; what the output must look like — file format and extension, structure, required metrics or comparisons, depth; which sources to search — web, official docs, and which MCPs apply (context7 for library docs, prod DB, HyperDX, tavily). Stop only when another round would change nothing.
2. **Outline** — `algo-research` with the topic plus the interview's requirements folded into the argument. Show the outline; one confirm — edit or go.
3. **Execute** — `algo-research-go` on that outline. The interview's output-shape and source requirements override the default report template wherever they conflict.
4. **Deliver** — report path, TL;DR verbatim, top recommendations. Open questions go back to the user — the loop ends with the delivered report.
