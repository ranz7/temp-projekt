---
name: grilling
description: Relentless structured interview that stress-tests a plan, decision, or idea until nothing is silently assumed. Use when the user says "grill me", "grill this plan", "przemagluj mnie", asks to stress-test their thinking or poke holes in a design, when a spec arrives with unstated assumptions that must surface before any work starts, or when a design discussion needs a disciplined interview round to close open decisions. Not for simple factual Q&A.
---

Interview the user relentlessly until you reach a shared understanding. Map the topic as a **design tree**: every decision branches into the decisions that hang off it. The session is a loop of rounds over that tree.

## Rounds and the frontier

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled — the questions you can ask *now* without guessing at answers you haven't heard yet.

- Each round, ask the **whole frontier at once** — every currently-unblocked question, batched into one message. Never drip questions one at a time.
- A question whose answer depends on another question still open in this round belongs to a **later** round, not this one.
- Each answered round reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round.

## Question format

Number questions **globally across the whole session** (round 2 continues where round 1 stopped), so answers-by-number are never ambiguous. Format every question like this:

```
❓ **Q3 — <question title>**: <question body; may be several paragraphs, may offer lettered choices (A/B/C)>

➡️ <your recommended answer, with one line of why>
```

Always give a recommendation. A grilling with no opinions is a questionnaire.

Harness with a question tool (e.g. AskUserQuestion) → route questions through it: numbering kept in the question text, recommended answer first; a round may span several calls.

## Answering by number

Tell the user (once, in round 1) that they can answer tersely by number:

- `3: B, 5: tak, 7: skip for now` — partial answers are fine; unanswered questions stay on the frontier.
- `wszystkie ➡️` / `all recommended` — accepts every open recommendation in the round.
- A free-text answer that overturns an earlier decision is allowed — re-open that branch and recompute the frontier.

## Facts vs decisions

Split every open point into one of two kinds:

- **Facts** are your job, never the user's. If a frontier question needs a fact from the environment — the codebase, git history, `package.json`, per-dir `CLAUDE.md` files, baza wiedzy (docs MCP: `docs_list_collections` / `docs_get_article`), the web — dispatch a background research subagent (e.g. an Explore agent) to find it. Never ask the user for anything you could look up yourself.
- **Don't stall the round on research.** A running exploration is just an unsettled prerequisite: only the questions downstream of it wait for the subagent to report. Ask the rest of the frontier now.
- **Decisions** are the user's. Put each one to them explicitly and wait. Never mark a decision "settled" from your own recommendation — a recommendation the user hasn't accepted is still an open question.

## Done — and the confirmation gate

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Then:

1. Present a compact summary of every decision taken (one line each) and any facts research turned up that changed the shape of the plan.
2. Ask the user to confirm you have reached a shared understanding.
3. **Do not start any work — no code, no file edits, no plan documents, no scaffolding — until the user explicitly confirms.** The confirmation gate is hard: an empty frontier is necessary but not sufficient.

After confirmation, hand settled decisions to `write-spec` (or implement if the user already locked a spec). This skill only interviews.
