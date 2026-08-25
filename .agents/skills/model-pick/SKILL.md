---
name: model-pick
description: Use when choosing a model and effort for any dispatch or phase - an implementation subagent, a mechanical git/db step, an interview, a verify pass. Other skills call this instead of guessing.
---

Two paths. **Best value** buys the most shipped work per unit of quota; **Best results** buys the best outcome and lets cost run. The user answers once, in the lane that asks (`feature`, `refactor`), and that answer is the whole run's path - matrix tasks and support roles alike. Silence, or a lane that never asks (`bugfix`, `research`, spec critics), runs Best value.

Inside a path, effort buys thinking time, not tier: start at the row's effort and escalate one step on observed failure before switching family.

## Paths by role

| Role | Best value | Best results |
|---|---|---|
| Orchestration, spec, interview, reviewing worker output | session model, session effort (epic → max) | session model, xhigh (epic → max) |
| Code from a spec | `cursor-grok-4.6-low` | Opus 5 subagent high writes, `gpt-5.6-sol-high` reviews each finished task |
| New module, migration, multi-file refactor | Opus 5 subagent, high | Fable 5 subagent, high writes, root reviews |
| UI, design system | Sonnet subagent, low | Opus 5 subagent high; `kimi-k3-high` when the task is pure aesthetics or Opus missed the look twice |
| Unit tests | `cursor-grok-4.6-low` | Sonnet subagent, medium |
| Integration tests (real DB, permissions, tRPC caller) | `cursor-grok-4.6-medium` | Opus 5 subagent, high |
| E2E, evidence capture, verify | Sonnet subagent, low | Opus 5 subagent, high |
| Debug, root cause | session model, high | session model xhigh, plus 2 non-Claude second opinions |
| Critique fan-out: spec critics, slow-lane cause hunt | `gemini-3.7-flash-high` + `cursor-grok-4.6-high` | `gpt-5.6-sol-xhigh` + `kimi-k3-max` + `cursor-grok-4.6-xhigh` |
| Code search, repo exploration | Haiku subagent, low | Sonnet subagent, low |
| Mechanical: commit, rename, config touch, db syntax, one-file patch | Haiku subagent, low | Haiku subagent, low |

Tests go to a different family than the code they judge - on either path, the model that wrote the chunk never owns its test row.

Harness mapping, three lanes in this order: an Anthropic model runs natively here - session model = the Claude Code main loop, Opus/Sonnet/Haiku/Fable are subagents; every `gpt-*` id runs natively too, through the `codex` skill; every other id (`cursor-*`, `gemini-*`, `kimi-*`, `composer-*`) goes through the `cursor-agent` skill. Both external skills need the write ask spelled out by the caller (`-s workspace-write` / `--force`). Cursor ids drift - confirm against `cursor-agent --list-models` before dispatch. Fable and Kimi are extra-cost, so both live on Best results only.

Say the fallback in chat when you take it. A dead Anthropic lane - 529 overloads, a session limit, a subagent lost mid-run - and a dead `cursor-agent` both fall to `codex`: same role, `gpt-5.6-sol`, effort matched to the row. Codex unreachable as well → Best value takes a Sonnet subagent at low, Best results the session model at xhigh, and an Anthropic lane still overloaded means waiting it out rather than dropping the row's tier.
