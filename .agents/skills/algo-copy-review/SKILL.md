---
name: algo-copy-review
description: >
  Use when writing, editing, or reviewing copywriting on the algoacademy.pl
  marketing site — the (marketing-site) route group (cennik, mentoring, o-nas,
  kursy, faq, hero / CTA / landing copy). Triggers: "copywriting", "copy review",
  "popraw teksty", "przepisz copy", "marketing copy", "nagłówek", "hero", "CTA".
  pl locale. Persuasion / conversion lens — not SEO keyword/E-E-A-T scoring.
allowed-tools: Read, Grep, Glob, WebFetch
user-invokable: true
argument-hint: "[strona / ścieżka / URL / wklejone copy]"
---

Read-only persuasion audit. Score blocks on the 10 principles below; 2–3 rewrites per weak/fail. Never edit files.

## Scope

- **In:** `apps/algoacademy/src/app/(marketing-site)/` copy — JSX string literals
  in `page.tsx`, `_sections/`, `_components/` (cennik, mentoring, o-nas, kursy, faq,
  czym-jest-mentoring, nasza-metoda-nauczania, hero/CTA/landing, …). Also any shared
  copy from `(marketing-site)/_components/` when it renders on the target page
  (e.g. `MentoringPricing` pulled into a page's `page.tsx`).
- **Out:** baza (read-only, auto-synced) · app UI (`app/`) · legal copy (regulamin,
  polityka-prywatnosci, RODO) → flag as out-of-scope, don't rewrite for persuasion.
- **Not this skill:** SEO keyword / E-E-A-T / readability scoring — this is
  persuasion/conversion only.

## Inputs

`$ARGUMENTS` = a marketing route (`cennik`, `mentoring`), a file path, a live URL,
or pasted copy. Missing/ambiguous → ask which page. Repo copy: locate with Grep/Glob
under `(marketing-site)`. Live URL: `WebFetch`.

## Workflow (read-only)

1. **Resolve target** — find the source. Repo → exact `file:line`. URL → fetch.
2. **Extract blocks by role** — hero H1, subhead, section headings, body, CTA labels,
   microcopy (form labels, tooltips), social proof. List each with `file:line`
   (line ranges OK for multi-line literals).
3. **Score** each block against the 10 principles. Score only *relevant* principles
   per block (a 3-word CTA carries no storytelling). Mark `pass` / `weak` / `fail`,
   cite the failing principles.
4. **Propose** — for each `weak`/`fail` block, write **2-3 alternative rewrites**,
   each tagged with the principles it strengthens. Keep pl + brand voice (education,
   mentoring; honest, concrete, no empty hype).
5. **Report** — per-block rubric table + ranked proposals. No edits.

## The 10 principles (rubric)

| # | Principle | Control question | Apply |
|---|-----------|------------------|-------|
| 1 | Visualization | Can the reader *see* it? | Concrete, tangible words → vivid mental image. Zoom to specific detail, not abstraction. |
| 2 | Falsifiability | Can it be proven true/false? | Replace vague claims ("dobre wartości") with validatable specifics (the action/behaviour). Builds credibility. |
| 3 | Uniqueness | Can nobody else say this? | Emphasize what only AlgoAcademy can claim. Drop generics a competitor could copy. |
| 4 | Conflict | Is there tension? | Frame on contrast — before/after, problem/solution. Show what's at stake. |
| 5 | Simplicity | Is it clear and tight? | Short sentences. Cut jargon and filler. Every word earns its place. |
| 6 | Pacing & structure | Does it flow? | Vary sentence length + punctuation for rhythm and emphasis on key points. |
| 7 | Storytelling | Does it connect emotionally? | Relatable scenario → tension → product as resolution. Reads like a letter, not an ad. |
| 8 | Use of facts | Is it grounded? | Anchor with a real fact/stat before the pitch. (See guardrail — never invent.) |
| 9 | Iteration | Is this the best version? | **Governs your proposals, not a per-block score** — each proposal is a deliberate rewrite, not a first draft; variants must differ meaningfully. Don't mark blocks pass/weak/fail on this row. |
| 10 | Audience-centric | Does it fit the reader? | Tailor to the reader's mindset + desired outcome; bridge the gap. Name the audience per page. |

Score blocks on principles 1-8 + 10 (9 scorable dimensions). #9 (Iteration) is a rule for how you write the proposals in step 4.

## Output format

Per block:

```
### <role> — `file:line`
> <current copy>

Rubric: ✅ Simplicity · ⚠ Visualization · ❌ Falsifiability, Uniqueness

Proposals:
A. "<rewrite>"  — strengthens: Falsifiability, Uniqueness
B. "<rewrite>"  — strengthens: Visualization, Conflict
C. "<rewrite>"  — strengthens: Storytelling, Simplicity
```

End with a 1-line summary: weakest principle across the page + highest-leverage fix.

## Guardrails — STOP

- **About to edit a file?** STOP. This skill is read-only. Applying a chosen proposal
  is a separate edit task the user requests explicitly.
- **About to invent a stat, number, or testimonial** (for Falsifiability / Use of facts)?
  STOP. Propose only verifiable claims. Mark anything needing data as `⚠ wymaga źródła`.
- **Reviewing baza, app UI, or legal copy?** Out of scope — say so, don't rewrite.
- **pl locale** — never flag Polish as a defect. Proposals stay in pl.
