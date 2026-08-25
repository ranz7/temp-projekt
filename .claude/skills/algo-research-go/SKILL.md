---
name: algo-research-go
description: Execute deep research based on a saved outline from /algo-research. Runs 15–25 iterative web searches, reads full pages, synthesizes with extended thinking. Saves timestamped report to .agents/research/.
argument-hint: "[outline-slug (optional — defaults to most recent outline)]"
context: fork
agent: general-purpose
effort: max
allowed-tools: WebSearch WebFetch Read Write Bash(date:*) Bash(ls:*) Bash(cat:*) Bash(git log:*) mcp__tavily__*
---

# algo-research-go

Read and follow the canonical repository workflow at `.agents/skills/algo-research-go/SKILL.md`.
