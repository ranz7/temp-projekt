---
name: algo-db-fix-syntax
description: Fix Drizzle schema.ts table/column/constraint naming syntax and keep relations in sync with FKs. Missing pgTable export = prune orphan relations/types; never restore deleted tables from git or migrations. Default scope is modules changed on the current branch vs main.
argument-hint: "[optional: module-name-or-schema-path to narrow scope]"
allowed-tools: Read, Grep, Glob, Edit, Bash(git diff:*), Bash(git status:*), Bash(git rev-parse:*), Bash(git merge-base:*)
---

`schema.ts` now is the source of truth. Naming: `.cursor/rules/backend/database-patterns.mdc`. Missing `pgTable` export → prune orphans. Never restore a table from git, `main`, migrations, or snapshots.

## Scope

No `$ARGUMENTS`: modules in `git diff --name-only main...HEAD -- packages/backend/` (or `origin/main...HEAD`). On `main` / empty branch diff: working-tree `git diff` + untracked. Still empty → stop. `$ARGUMENTS` = one module or one `schema.ts`.

## Per file

1. Allowed tables = `export const X = pgTable(` in this file.
2. Delete `__relations`, parent `many()`, `$infer*` that name a table not in that set. Remove leftover tokens from half-deletes.
3. Fix names on **existing** tables only (minimal diff). Preserve comments unless a rename makes one false.
4. Re-derive relations from `foreignKey` blocks still in the file: child `one()` matches FK columns; parent `many()` if the file already uses that pattern. Composite FKs include every column. Keep existing relation property keys.
5. Grep the module for stale export names — straight renames only.

Print branch + file list first. Summary per module. No `db:generate`, no migration edits, no other modules' `schema.ts`.
