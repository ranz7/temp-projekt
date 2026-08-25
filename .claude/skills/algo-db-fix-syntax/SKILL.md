---
name: algo-db-fix-syntax
description: Fix Drizzle schema.ts table/column/constraint naming syntax and keep relations in sync with FKs. Missing pgTable export = prune orphan relations/types; never restore deleted tables from git or migrations. Default scope is modules changed on the current branch vs main.
argument-hint: "[optional: module-name-or-schema-path to narrow scope]"
allowed-tools: Read, Grep, Glob, Edit, Bash(git diff:*), Bash(git status:*), Bash(git rev-parse:*), Bash(git merge-base:*)
---

# algo-db-fix-syntax

Read and follow the canonical repository workflow at `.agents/skills/algo-db-fix-syntax/SKILL.md`.
