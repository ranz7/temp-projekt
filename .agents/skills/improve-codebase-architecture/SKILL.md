---
name: improve-codebase-architecture
description: Find deepening opportunities in a codebase — refactors that turn shallow modules into deep ones, for testability and AI-navigability. Use when the user wants to improve architecture, find refactoring opportunities, consolidate tightly-coupled modules, or make a codebase easier to navigate.
disable-model-invocation: true
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability.

Vocabulary discipline: use [LANGUAGE.md](LANGUAGE.md) terms exactly (**module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality**; the deletion test; "the interface is the test surface"; "one adapter = hypothetical seam, two = real"). Don't drift into "component," "service," "API," or "boundary." Domain terms come from baza wiedzy and the per-dir `CLAUDE.md` files.

## Process

### 1. Explore

**Scope before you scan — YAGNI.** Deepening a module pays off by making future changes to it easier, so put extra weight on the parts of the codebase that have recently changed:

- If the user named a direction — a module, a subsystem, a pain point — take it.
- Otherwise, walk back a good stretch of `git log --oneline` to find the hot spots — files and areas that keep coming up — and let those paths pull your attention first. Scattered changes with no hot spot → widen the net.

**Read prior surveys first**: check `.claude/plans/*-architecture-survey.md` for candidates already rejected — do not re-suggest anything listed there unless the friction has visibly grown since.

Then spawn a sub-agent (Explore) to walk the code. No rigid heuristics — note where you experience friction:

- Understanding one concept requires bouncing between many small modules.
- Modules are **shallow** — interface nearly as complex as the implementation.
- Pure functions extracted "for testability" while the real bugs hide in how they're called (no **locality**).
- Tightly-coupled modules leaking across their seams.
- Parts that are untested, or hard to test through their current interface.

Apply the **deletion test** as the candidate filter: would deleting this module concentrate complexity, or just move it? Only "yes, concentrates" candidates make the report.

### 2. Present candidates

Produce the survey as an Artifact (self-contained HTML — CSP forbids CDN scripts, so inline all CSS and use mermaid fences for graph-shaped diagrams) or, when Artifact publishing is unavailable, as `.claude/plans/<YYYY-MM-DD-HH.MM>-architecture-survey.md`.

For each candidate:

- **Files** — which files/modules are involved
- **Problem** — why the current architecture causes friction
- **Solution** — plain-English description of what would change
- **Benefits** — in terms of locality and leverage, and how tests would improve
- **Before / After sketch** — the shallowness and the deepening, side by side
- **Recommendation strength** — badge: `Strong` / `Worth exploring` / `Speculative`

End with a **Top recommendation**: which candidate to tackle first and why.

Do NOT propose interfaces yet. Ask the user: "Which of these would you like to explore?"

### 3. Decide and record

Once the user picks a candidate, run `grilling`, then `write-spec`. No implementation plan.

**Rejected-candidate memory:** when the user rejects a candidate with a load-bearing reason, append it to the survey doc in `.claude/plans/` under a `## Rejected` heading — one line: candidate + reason. Future runs read these files (step 1) and stay silent about re-suggesting. Skip ephemeral reasons ("not now") — record only reasons a future explorer needs.
