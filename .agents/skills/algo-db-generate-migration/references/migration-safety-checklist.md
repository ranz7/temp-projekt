# Migration safety checklist (zero-downtime review)

Review the most recent generated Drizzle migration SQL before applying. Audit-only: never
apply the migration, never edit the `.sql` file (migrations are immutable after generation —
if a CRITICAL split is needed, propose the new migration sequence; the owner decides whether
to delete the unsafe migration and re-generate from a corrected schema).

## Workflow

1. Find the newest file in `packages/backend/src/database/migrations/*.sql` (highest numeric prefix).
2. Read it.
3. Cross-reference with the schema diff: `git diff -- '**/schema.ts'`.
4. Classify each statement per the table below and report severity.

## Severity table

| Pattern | Severity | Why |
|---|---|---|
| `DROP COLUMN` / `DROP TABLE` | CRITICAL | Data loss; old code in flight will break |
| Renamed column (Drizzle emits drop+add) | CRITICAL | Data loss |
| `ADD COLUMN ... NOT NULL` without `DEFAULT` on a non-empty table | CRITICAL | Migration fails or fills with garbage |
| Type change (`ALTER COLUMN ... TYPE`) without explicit `USING` cast | CRITICAL | Lossy or fails for incompatible values |
| New FK to a lookup table not seeded in `seed.ts` | CRITICAL | Insert will violate FK |
| New index (`CREATE INDEX`) without `CONCURRENTLY` on a hot table | WARNING | Locks the table during migration |
| New FK column without an explicit index on the FK column | WARNING | Slow cascading deletes / ON UPDATE CASCADE |
| New nullable column / new table | OK | Safe |

## Output format

```markdown
## CRITICAL
- <statement> — <why> → <fix>
  - **Fix:** split into N migrations: <step 1> → <step 2> → ...

## WARNING
- ...

## OK
- (count) safe statements

## Recommendation
<apply | revise | abort>
```
