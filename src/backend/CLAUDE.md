# src/backend/CLAUDE.md

Scope: tRPC + Drizzle backend. Vertical Slice Architecture.

## Module structure

Every module under `src/backend/modules/<module>/`:

```
<module>/
├── endpoints/
│   ├── queries/<endpoint-name>/
│   │   ├── index.ts
│   │   ├── input.dto.ts
│   │   └── output.dto.ts
│   └── mutations/<endpoint-name>/
├── router.ts
├── seed.ts
└── schema.ts
```

`internal-functions/` only when 2+ endpoints in the same module need the logic.
DTOs always in separate files. Named exports only. `type`, not `interface`.
Procedure naming: kebab-case directory + verb-noun. Router keys drop noisy suffixes (`listNotes`).

## Database

- Schema barrel: `src/backend/database/schema.ts` re-exports each module's `schema.ts`.
- Table names: `<module>__<noun>_` (trailing underscore). Every identifier ends with `_` except the `note__note_.id` PK, which the skeleton spec locked as `id`.
- Primary keys: UUIDv7 via `uuid().default(uuidv7)` (`uuidv7` from `database/sql-functions.ts` → `uuid_generate_v7()`, created by migration `0000__uuid_v7.sql`).
- **Never invent entity ids** — omit the PK on insert.
- **Every `db.delete()` and `db.update()` MUST have `.where()`**.
- Migrations are immutable after generation — never edit a file in `database/migrations/`.

## Testing

Never mock the database. Integration suite uses `projekt_test` on the same Docker Postgres.
`bun run test` is unit. `bun run test:integration` is the real-DB suite.
