---
name: cursor-agent
description: Use when a task needs a model only Cursor reaches - "ask cursor", "second opinion", review or plan critique with gemini/grok/composer/kimi, or several models on one question in parallel.
---

Delegate one task to Cursor's headless CLI for a second opinion from a model Cursor alone reaches: `cursor-*`, `gemini-*`, `kimi-*`, `composer-*`. Anthropic ids - Fable included - run natively in this harness as subagents, and `gpt-*` ids through the `codex` skill, so neither belongs here. Claude stays the host: it frames the prompt, runs the CLI, digests the answer. The CLI reads the repo; the default lane writes nothing.

## Preflight

- Binary: `cursor-agent --version`. Missing → the user installs it themselves (`! curl https://cursor.com/install -fsS | bash`) — the installer is classifier-blocked for agents.
- Auth: on an auth failure, export `CURSOR_API_KEY` from root `.env` for the call without printing it (`export CURSOR_API_KEY=$(grep '^CURSOR_API_KEY=' .env | cut -d= -f2-)`).
- Root `.cursorignore` keeps `.env` and keys out of Cursor's context — restore it before running if deleted.

## Run

Model: map the user's hint to an exact ID from `cursor-agent --list-models` — the list is the source of truth, IDs drift too fast to cache here. No hint → omit `--model` (Cursor's default composer).

```bash
cursor-agent -p --output-format text [--model <id>] "<prompt>"
```

Prompt framing for a review: name the diff scope (`git diff origin/main...HEAD` or paths), ask for file:line findings on correctness, edge cases, security; skip nitpicks; ~400 words.

Writes to the repo happen only when the user explicitly asked Cursor to edit; adding `--force` is the user's call, never yours.

Parallel: several models on one question = background runs in one Bash block. Done when every requested model has either returned output or had its failure reported with the exit code.

## Digest

Relay findings with file:line references intact, then a 3–5 bullet TL;DR; flag explicitly where you disagree. Treat the output as a colleague's review — verifiable, not authoritative.
