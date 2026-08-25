---
name: algo-research
description: Generate a deep research outline for a topic with full project context. Saves outline to .agents/research/ for review. Follow up with /algo-research-go to execute the full research. Use when the user wants to research, investigate, or find best practices for a topic.
argument-hint: "[topic to research]"
context: fork
agent: general-purpose
effort: max
allowed-tools: Read Write Bash(date:*) Bash(mkdir:*) Bash(git log:*) Bash(ls:*)
---

Research outline for the topic, grounded in this repo.

**Topic:** $ARGUMENTS

---

## Auto-injected project context

Recent commits:
```
!`git log --oneline -10`
```

Prior research in this project:
```
!`ls .agents/research/ 2>/dev/null | grep -v outline | sort -r | head -10 || echo "(none)"`
```

Existing outlines (not yet executed):
```
!`ls .agents/research/outline-*.md 2>/dev/null | sort -r | head -5 || echo "(none)"`
```

---

## Your task

1. Read `CLAUDE.md` and `package.json` to understand the exact stack, conventions, and constraints.
2. Identify which parts of the project are most relevant to `$ARGUMENTS`.
3. Check prior research — note what was already researched to avoid duplication.
4. Formulate **10–14 targeted research questions** that together give a complete picture of the topic. Cover:
   - Core concepts and how they work
   - Best practices and patterns (2024–2026)
   - Integration specifics for this stack: Next.js 16 App Router, tRPC v11, Drizzle ORM, TypeScript strict, React Compiler, Tailwind, BetterAuth
   - Known pitfalls, edge cases, security considerations
   - Performance implications
   - Real-world examples and production case studies
   - Alternatives and tradeoffs
   - What to avoid and why

5. For each question, add:
   - **Priority**: high / medium
   - **Suggested search query**: the exact search string to use
   - **Expected output**: what a good answer looks like

---

## Save outline

Generate timestamp:
```bash
date +%Y-%m-%d-%H.%M
```

Slugify topic: lowercase, hyphens, max 60 chars.

Save to `.agents/research/outline-<YYYY-MM-DD-HH.MM>-<slug>.md`:

```markdown
---
topic: <original topic>
created: <YYYY-MM-DD-HH.MM>
status: pending
---

# Research Outline: <topic>

## Project Context Notes

<2–3 sentences on how this topic relates to the current codebase. Which modules/patterns are affected.>

## Prior Research

<Link to any relevant prior research, or "None found.">

## Research Questions

### 1. <Question> [priority: high]
- **Search query**: `<exact query>`
- **Expected output**: <what a good answer looks like>

### 2. <Question> [priority: high]
...

(10–14 questions total)

## Success Criteria

This research is complete when we can answer:
- <Key decision 1>
- <Key decision 2>
- <Key decision 3>
```

---

## Return to main conversation

After saving, output:

1. File path of the saved outline
2. The 3 highest-priority questions as a quick preview
3. This exact message:

> **Review the outline** at `.agents/research/outline-<slug>.md`. Edit questions if needed — add, remove, or reword.
> When ready, run: `/algo-research-go` (uses most recent outline) or `/algo-research-go <slug>` for a specific one.
