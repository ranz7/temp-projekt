---
name: codex
description: Use when the model to run is a ChatGPT one (`gpt-*`), when the Anthropic lane is down - 529 overloads, a session limit, a subagent lost mid-run - and the work must still run, or on "ask codex". Runs the task through the Codex CLI, headless.
---

Delegate one task to the Codex CLI. ChatGPT models run here natively, not through Cursor, and this is also the lane that keeps a run moving when the Anthropic side is unavailable. Claude stays the host: it frames the prompt, runs the CLI, digests the answer.

## Preflight

- Binary: `codex --version` (codex-cli, `~/.local/bin/codex`). An install, config or auth that misbehaves: `codex doctor`.
- Auth: `codex login status`. Not logged in, or the token expired, the user runs `codex login` themselves - the browser flow is theirs.
- Sandbox: `-s/--sandbox read-only` is the default lane. `workspace-write` only where the calling skill carries the write ask; `danger-full-access` never.

## Run

```bash
codex exec -s read-only [-m <id>] [-c model_reasoning_effort="high"] -o <file> "<prompt>" </dev/null
```

- `codex exec` (alias `codex e`) is the non-interactive form. `-m/--model` takes the bare id (`gpt-5.6-sol`); the effort in a `model-pick` row (`gpt-5.6-sol-high`) is `model_reasoning_effort`, not part of the id. No hint on either, omit both and the CLI's configured default answers.
- stdout carries a header, the run and the final message; `-o <file>` writes the final message alone, which is the part you read. Piped stdin is appended to the prompt, so `</dev/null` keeps a background run from waiting on it.
- Review framing: name the diff scope (`git diff origin/main...HEAD` or paths), ask for file:line findings on correctness, edge cases, security; skip nitpicks; ~400 words.
- Implementation instead of an opinion - the Anthropic-lane fallback: `-s workspace-write`, and a prompt carrying spec path, task and file list, the same one the lost worker would have read.
- Parallel: several models on one question = background runs in one Bash block. Done when every requested model has either written its final message or had its failure reported with the exit code.

## Digest

Relay findings with file:line references intact, then a 3-5 bullet TL;DR; flag explicitly where you disagree. Treat the output as a colleague's review - verifiable, not authoritative. Where it wrote to the tree, read the diff before calling the task done.
