---
name: algo-research-go
description: Execute deep research based on a saved outline from /algo-research. Runs 15–25 iterative web searches, reads full pages, synthesizes with extended thinking. Saves timestamped report to .agents/research/.
argument-hint: "[outline-slug (optional — defaults to most recent outline)]"
context: fork
agent: general-purpose
effort: max
allowed-tools: WebSearch WebFetch Read Write Bash(date:*) Bash(ls:*) Bash(cat:*) Bash(git log:*) mcp__tavily__*
---

Execute the saved outline. Full pages, not snippets. Synthesize for this repo.

**Argument (outline slug or empty):** $ARGUMENTS

---

## Auto-injected project context

Recent commits:
```
!`git log --oneline -10`
```

Available outlines:
```
!`ls .agents/research/outline-*.md 2>/dev/null | sort -r | head -10 || echo "(none — run /algo-research <topic> first)"`
```

---

## Phase 1 — Load outline

If `$ARGUMENTS` is empty or not provided: use the most recent outline from the list above.
If `$ARGUMENTS` is a slug: find the matching file in `.agents/research/outline-*-<slug>.md`.

Read the outline file. Extract:
- Topic
- All research questions (in priority order: high first)
- Project context notes
- Success criteria

If no outline exists, abort and tell the user to run `/algo-research <topic>` first.

---

## Phase 2 — Load project context

Read `CLAUDE.md` and `package.json` to understand the stack, conventions, and constraints. This informs how you evaluate sources and frame recommendations.

---

## Phase 3 — Iterative web research

Search engine priority:
1. **Tavily** (`mcp__tavily__tavily_search`) — use if available, better content extraction
2. **WebSearch** — fallback if Tavily unavailable
3. **WebFetch** — always use to read full page content (never rely on snippets alone)

Work through research questions in priority order. For each:

1. Run 1–3 targeted searches using the suggested query (and variants if needed)
2. For each promising result: use WebFetch to read the **full page content** — not just the snippet
3. Extract the key insight, note the source URL
4. Based on what you learn, refine subsequent searches — let earlier findings shape later queries
5. When a source references another important source, follow it
6. After answering the question, note: gaps remaining, contradictions found, follow-up questions

**Targets:** 15–25 total searches, 8–15 full pages read.

Track a running list:
- Questions answered ✓
- Questions in progress...
- Gaps remaining

---

## Phase 4 — Synthesis

After all questions are answered:

- Identify patterns across sources
- Resolve contradictions (prefer: official docs > GitHub issues/PRs > blog posts)
- Rank recommendations by impact + feasibility for THIS project
- Identify what applies directly vs. what needs adaptation for this stack
- Verify all "success criteria" from the outline are addressed

---

## Phase 5 — Save report

Generate timestamp:
```bash
date +%Y-%m-%d-%H.%M
```

Slugify the topic: lowercase, hyphens, max 60 chars.

Save to `.agents/research/<YYYY-MM-DD-HH.MM>-<slug>.md`:

```markdown
---
topic: <original topic>
outline: <path to source outline file>
last_modified: <YYYY-MM-DD-HH.MM>
sources_searched: <count>
sources_read: <count>
---

# Research: <topic>

## TL;DR

<4–6 sentences. The essential insight + recommended approach for THIS project specifically. Be opinionated — say what to do, not just what exists.>

## Project Context

<How this topic relates to the current codebase. Reference specific modules, files, patterns, or constraints. 2–3 paragraphs.>

## Key Findings

### <Finding 1>
<Detailed explanation. Include code examples where they clarify. Cite sources inline as [Source Title](url).>

### <Finding 2>
...

(cover all major findings, one section per distinct insight)

## Recommendations for This Project

Ordered by priority and impact:

1. **<Action>** — <why, what to change, which file/module/pattern>
2. **<Action>** — ...
3. ...

## Tradeoffs & Alternatives

| Approach | Pros | Cons | Fit for this project |
|----------|------|------|----------------------|
| ... | ... | ... | ✓ Recommended / ✗ Avoid / ⚠ Consider |

## What to Avoid

- **<Anti-pattern>**: <why it's problematic in this specific context>
- ...

## Open Questions

Requires team decision or further investigation:
- ...

## Sources

| # | Title | URL | Key insight |
|---|-------|-----|-------------|
| 1 | ... | [link](url) | ... |
```

Mark the outline file as completed by updating its `status: done` frontmatter.

---

## Return to main conversation

Output:
1. File path of the saved report
2. The TL;DR verbatim
3. Top 3 recommendations as bullets
4. Any open questions that need team input
