---
name: algo-db-generate-migration
description: Run drizzle-kit generate after a schema change, rename migration to project convention, update journal tag
allowed-tools: Read, Edit, Glob, Bash(bunx drizzle-kit generate:*), Bash(ls:*), Bash(mv:*), Bash(bun run db:generate:*), Bash(grep:*)
---

Review `git diff -- '**/schema.ts'` first. Destructive ops must be intentional.

1. `SKIP_ENV_VALIDATION=1 BETTER_AUTH_SECRET=dummy-secret-at-least-32-chars-long bunx drizzle-kit generate`
2. Rename the stub in `packages/backend/src/database/migrations/` to `XXXX__module__action__description_.sql` (`action` ∈ add|update|rename|remove|migrate; description `_`-separated, trailing `_`).
3. `_journal.json` `tag` = new filename minus `.sql`.
4. Open the SQL. Risky `DROP` / `SET NOT NULL` → `references/migration-safety-checklist.md`.
5. Patch `packages/backend/src/database/data/dump.sql` (`--data-only --column-inserts`) when INSERTs would break:

| SQL | Dump |
|---|---|
| ADD COLUMN nullable/default | no change |
| ADD COLUMN NOT NULL, no default | add column+seed to INSERTs, or confirm table has no dump rows |
| DROP COLUMN | drop that column+value from INSERTs |
| RENAME COLUMN/TABLE | rename inside INSERTs |
| CREATE TABLE | no change |
| DROP TABLE | remove that table's INSERT block |

No `INSERT INTO public.<table>` in the dump → skip that table. Grep old names after edits.

Do not `db:migrate` / `db:push`. Do not commit. Tell the user the new filename and whether the dump changed.
