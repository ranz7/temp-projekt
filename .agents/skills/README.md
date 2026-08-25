# Skills — authoring guide

Canonical skill tree for ALL agents (Claude Code, Cursor, Codex, Omnigent workers).
One skill = one directory here: `.agents/skills/<name>/SKILL.md` + optional support files
(`references/*.md`, `scripts/*`, `agents/openai.yaml`).

Discovery for Claude Code / Cursor happens through stubs in `.claude/skills/<name>/SKILL.md`:

```markdown
---
name: <name>
description: <full trigger description — copied verbatim from the canonical skill>
---

# <Title>

Read and follow the canonical repository workflow at `.agents/skills/<name>/SKILL.md`.
```

Rules for stubs: frontmatter identical to canonical (the description drives skill selection);
body is only the pointer line. Editing a skill = edit the canonical file; regenerate the stub
only when frontmatter changes.

Craft: follow `.agents/skills/writing-for-agents/SKILL.md`. Vendored from
`mattpocock/skills@8b78b531ab965735c5dc74f6f7a219e1e37326df`. Update = re-copy;
do not edit the vendored body.

- **Naming**: project-specific skills `algo-<domain>-<action>` (e.g. `algo-db-generate-migration`);
  general tool skills plain kebab-case (`diagnose`, `prototype`).
- **Frontmatter**: `name`, `description` required. Optional: `argument-hint`,
  `disable-model-invocation: true` (user-only slash commands, expensive ops), `model` (avoid
  pins unless a cheap model demonstrably suffices — pins rot).
- **Scripts**: deterministic work belongs in scripts (invoked via package.json or devbox bins),
  judgment stays in the skill text. Document BOTH invocations when devbox and local differ.

## What does NOT belong here

- Project conventions already in `CLAUDE.md` / per-dir `CLAUDE.md` / `.cursor/rules/` — link, don't copy.
- Domain knowledge — that lives in baza wiedzy (docs MCP, read-only for agents).
- Process rituals the current models do by default (verify-before-done, read-before-edit).
- A `## Purpose` block inside `SKILL.md` — the catalog below is the single source.

## Catalog

Solves / Does not, ≤40 words per skill. Add a row when you add a skill. Do not
repeat this boundary inside the skill body.

### Authoring

- **writing-for-agents** — Solves: writing agent-facing docs so they change behaviour. Does not: shipping a workflow kit or writing app code.
- **write-spec** — Solves: shortest agent spec that locks product decisions and kills ambiguity; picks the lane (oneshot/standard/epic). Does not: implementation plans or writing code.
- **implement-spec** — Solves: confirmed spec → task groups → subagents → verified code. Does not: writing the spec or expanding its scope.
- **patch-spec** — Solves: amending a locked spec and shipping the delta. Does not: new features (write-spec) or a full re-interview.
- **feature** — Solves: user-invoked lane driving one feature spec → task plan → implement → evidence PR → babysit, to merge, by chaining the phase skills. Does not: replace any phase skill or start without the user typing it.
- **model-pick** — Solves: model + effort per role for any dispatch, on two paths the user picks between once (Best value / Best results). Does not: running the task or benchmarking models.
- **grilling** — Solves: closing unstated decisions before work starts. Does not: writing the spec (`write-spec`) or implementing.
- **wait-what** — Solves: last message missed — re-pitch in plain language. Does not: new work or changing the plan.
- **handoff** — Solves: packing this session so another agent can continue. Does not: finishing the feature.
- **zoom-out** — Solves: how this code fits the bigger picture. Does not: refactors or architecture programs.
- **prototype** — Solves: throwaway prototype to answer a design question. Does not: production code.
- **improve-codebase-architecture** — Solves: finding deep-module refactors. Does not: implementing the refactor unless asked.

### Backend

- **algo-backend-create-module** — Solves: new backend module (router, schema, endpoints). Does not: one endpoint in an existing module.
- **algo-backend-create-endpoint** — Solves: add or refactor one tRPC procedure. Does not: new modules or RBAC work.
- **algo-backend-add-permission** — Solves: new RBAC permission + aggregation + role. Does not: wiring that permission into UI or endpoints.

### Database

- **algo-db-generate-migration** — Solves: drizzle-kit generate, rename, journal. Does not: number collisions after rebase.
- **algo-db-fix-syntax** — Solves: schema.ts naming and relations vs FKs. Does not: generating SQL migrations.
- **algo-db-merge-migrations** — Solves: duplicate migration numbers after rebase, plus poisoned preview DB. Does not: first-time generate.

### Git / delivery

- **algo-git-commit** — Solves: Conventional Commit from staged diff. Does not: push or open a PR.
- **algo-git-pr** — Solves: PR to main; evidence-bullet body; commits dirty tree first; fires the babysit loop. Does not: run that loop itself (algo-git-babysit).
- **algo-git-babysit** — Solves: open PR to green CI + resolved threads. Does not: merging (human) or product decisions from comments.
- **fix-before-git-pr** — Solves: optional local CI when the user asks. Does not: GitHub Actions (that is the gate).
- **resolving-merge-conflicts** — Solves: conflicted merge/rebase, intent per hunk. Does not: aborting the rebase or rewriting history.

### Quality

- **diagnose** — Solves: hard bugs via reproduce → hypothesise → fix. Does not: drive-by patches.
- **bugfix** — Solves: user-invoked lane — fast/slow by difficulty (slow adds non-Claude second opinions + prod DB/HyperDX MCPs), diagnose to regression-tested fix, PR, babysit. Does not: fire without the user typing it.
- **refactor** — Solves: user-invoked lane — scoped refactor split into delegated tasks judged on perf + repo rules; before→after PR; babysit. Does not: pick its own scope or change behaviour.
- **algo-review-branch** — Solves: branch-vs-main review; findings as a plan. Does not: implementing the fixes.
- **review-diff** — Solves: final-review digest — changes, risk, what to read. Does not: fan-out audit (algo-review-branch) or fixes.
- **algo-copy-review** — Solves: persuasion audit of marketing copy; proposals only. Does not: SEO scoring or editing files.
- **cursor-agent** — Solves: second opinion from a model only Cursor reaches (gemini/grok/composer/kimi) via Cursor CLI headless; parallel multi-model. Does not: `gpt-*` ids (codex) or repo writes by default.
- **codex** — Solves: ChatGPT (`gpt-*`) models natively via Codex CLI headless; the fallback lane when the Anthropic side is down. Does not: repo writes unless the caller carries the write ask.
- **capture-ui-evidence** — Solves: browser evidence after a UI change. Does not: finding why it is slow.
- **algo-debug-performance** — Solves: fix slowness front-to-back. Does not: evidence capture without a fix.
- **algo-setup-env** — Solves: `.env` via local bash wizard; secrets stay off chat. Does not: changing app config code.

### Research

- **algo-research** — Solves: research outline grounded in this repo. Does not: running the searches.
- **algo-research-go** — Solves: execute a saved outline into a report. Does not: planning the questions.
- **research** — Solves: user-invoked lane — relentless scoping interview (output shape, sources, MCPs), then outline + executed report into `.agents/research/`. Does not: start searching before the interview closes.
