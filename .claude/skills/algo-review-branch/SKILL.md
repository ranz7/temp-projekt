---
name: algo-review-branch
description: Full review cycle for the current branch vs main — routes changed files to review-checklist dimensions and fans out isolated subagents. Saves findings as a plan file by default. Use --scope for single-module focus.
argument-hint: "[--scope <path>] [--no-plan]"
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git log:*), Bash(git status:*), Bash(git rev-parse:*), Bash(git merge-base:*), Bash(git show:*), Bash(ls:*), Bash(wc:*), Bash(bun:*), Bash(date:*), Write, Agent
disable-model-invocation: true
---

# Branch Review

Read and follow the canonical repository workflow at `.agents/skills/algo-review-branch/SKILL.md`.
