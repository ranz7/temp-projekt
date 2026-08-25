---
name: algo-backend-create-endpoint
description: Add or refactor a backend tRPC endpoint (query/mutation). Use for new procedures, endpoint refactors, or consolidating DB reads.
---

Rules: `packages/backend/src/CLAUDE.md` · `.cursor/rules/backend/{js-doc,input-validation-patterns,using-permissions,endpoint-patterns,database-query-patterns,external-functions}.mdc`. Helpers: `references/internal-functions.md`. Gate patterns: `references/permission-examples.md`.

```
endpoints/{queries|mutations}/<name>/{index.ts,input.dto.ts,output.dto.ts}
```

One folder per endpoint. Router wires only.

## Permission — pick before code

Read `permissions.ts` in the home module **and** every module reached via `external-functions/`. Match the action to a level `description`. Lowest covering level. Never OR two levels in the same group.

- Every caller needs a gate → `protectedProcedure([MINIMUM])`. ASSIGNED → also `ensure*`.
- Anonymous or shape-varies → `publicProcedure` + `ctx.user.hasPermissions` / try `ensure*`. JSDoc records the branches.
- Permission constant lives in the module that **owns the resource**.

## Reads / writes

Same-module sequential reads that only exist because B needs A's ids → one join. Other module's tables → that module's `external-functions/`, never a cross-module join (handler and `_helpers/`). Independent reads → `Promise.all`. Existence → one-column `select` or a small `external-functions/queries/<check>/`, not `get-*-by-id`.

Mutations: endpoint owns `ctx.db.transaction`; pass `trx` into helpers. Return the entity id, not `{ success: true }`.

Output DTO: compose the helper's `*OutputZ` (`.pick`/`.omit`/`.nullable`). No inline re-declaration of that shape.

## Done

- [ ] Minimum permission whose description matches; JSDoc matches the gate
- [ ] `.meta({ operation: '<module>.<camelCase>', procedureKind })`
- [ ] Polish `TRPCError` messages
- [ ] No waterfall same-module reads; no cross-module table imports
- [ ] Nested DTO fields compose helper `*OutputZ`
