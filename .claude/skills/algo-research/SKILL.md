---
name: algo-research
description: Generate a deep research outline for a topic with full project context. Saves outline to .agents/research/ for review. Follow up with /algo-research-go to execute the full research. Use when the user wants to research, investigate, or find best practices for a topic.
argument-hint: "[topic to research]"
context: fork
agent: general-purpose
effort: max
allowed-tools: Read Write Bash(date:*) Bash(mkdir:*) Bash(git log:*) Bash(ls:*)
---

# algo-research

Read and follow the canonical repository workflow at `.agents/skills/algo-research/SKILL.md`.
