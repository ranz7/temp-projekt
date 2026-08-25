---
name: handoff
description: Use when the current session's work must continue somewhere else — the user says "handoff", "wrap this up for a new session", context is nearly full, work is being parked for later, or the user wants to fork the current thread into several parallel sessions (e.g. one per subsystem). Compacts the conversation into a portable handoff document a fresh agent can pick up.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work.

## Where it goes

Save to **`.claude/handoffs/`** in the repo, named by the repo's timestamped-file convention: `YYYY-MM-DD-HH.MM-<topic>.md`.

- Before writing, make sure the directory is gitignored: `git check-ignore -q .claude/handoffs/x || printf '\n.claude/handoffs/\n' >> .gitignore`. Handoffs are session scratch — they must never land in a commit.
- This repo-local directory deliberately replaces the upstream default of the OS temp dir: handoffs survive reboots and session restarts on this machine, sit next to the repo they describe, and are shared between Claude Code and Cursor sessions — while staying out of git.

## What it contains

- The goal, current state, and exact next steps — precise enough that the new agent does not re-derive them.
- Decisions made and *why* — the reasoning is the part the next session cannot recover on its own.
- Gotchas hit and dead ends already ruled out.
- A **"Suggested skills"** section: skills the next agent should invoke (e.g. `grilling`, `diagnose`, `algo-backend-create-module`), with one line on why each.

## Reference, don't copy

Do not duplicate artifacts — specs in `.agents/specs/`, plans in `.claude/plans/`, commits, diffs, PRs, baza. Reference by path or hash. A handoff is a map, not a second copy.

## Redact

Redact any sensitive information: API keys, tokens, passwords, `.env` values, personally identifiable information. Assume the handoff file may be pasted into any context.

## Tailoring and forking

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the document accordingly.

One handoff may seed **several** sessions: when the remaining work splits cleanly (e.g. backend half / frontend half), say so in the document and mark which sections belong to which fork.

Finish by telling the user the file path and a one-line starter prompt for the next session, e.g.: `Read .claude/handoffs/<file> and continue the work.`
