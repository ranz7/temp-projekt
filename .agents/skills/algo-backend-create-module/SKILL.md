---
name: algo-backend-create-module
description: Create a new backend module with tRPC router, schema, and endpoints. Use when asked to "create module", "add backend module", "new tRPC module".
---

Scaffold under `packages/backend/src/modules/<name>/`. Mirror `course` or `account` for file shape. Naming: `.cursor/rules/backend/database-patterns.mdc`. First endpoint: `algo-backend-create-endpoint`. Helpers: that skill's `references/internal-functions.md`.

```
endpoints/{queries,mutations}/
internal-functions/{queries,mutations}/   # only when 2+ endpoints share logic
external-functions/{queries,mutations}/   # other modules call these
router.ts
schema.ts
```

1. Create the tree. `internal-functions/` stays empty until a second endpoint needs the same logic.
2. Thin `router.ts` — wire procedures, no business logic.
3. Register in `packages/backend/src/appRouter.ts`.
4. One real endpoint (`index.ts` + `input.dto.ts`) via `algo-backend-create-endpoint`.
5. `bun run boundaries:modules:generate`.

Endpoint owns `ctx.db.transaction`. `internal-functions/mutations` take required `trx`. `external-functions/mutations` take optional `trx` and open a transaction only when omitted. Context ids (`userId`, …) are arguments, not Zod fields.
