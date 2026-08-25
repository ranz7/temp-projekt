# Internal Functions — when to extract

Reference for `algo-backend-create-endpoint`. Authoritative cross-module rule: `.cursor/rules/backend/external-functions.mdc`.

## When to add `internal-functions/`

Add `internal-functions/queries/<name>/` or `internal-functions/mutations/<name>/` **only when more than one endpoint in the same module needs the logic**.

- **2+ endpoints** in the same module → `internal-functions/` with `index.ts` + `input.ts` + `output.ts`
- **1 endpoint only** → keep logic in the endpoint (`index.ts`) or co-locate a sibling helper in the endpoint folder (e.g. `endpoints/queries/get-assignment/_helpers/get-assignment-problem-rating-goals-for-student.ts`). **Do not** create `internal-functions/` for a single consumer.
- **1 internal-function/mutation only** → co-locate in `_helpers/` next to that function (e.g. `internal-functions/mutations/rate-problem-in-goals/_helpers/check-if-student-can-rate-problem.ts`). Same rule as endpoint `_helpers/`.
- Endpoint `_helpers/` with DB access → same join / `Promise.all` / no-waterfall rules as the handler; **no cross-module table joins** — `external-functions/` only (.agents/skills/algo-backend-create-endpoint/SKILL.md **Reads**).

## Exceptions (still valid in `internal-functions/`)

- **`ensure*`-style permission helpers** shared by multiple endpoints in the module (e.g. `ensure-can-manage-collection`)
- Logic already shared by **2+ endpoints** — even if one is a query and one is a mutation

## Do not use `internal-functions/` for

- Thin wrappers that only map endpoint input → DB call with no reuse
- Mutation logic consumed by exactly one tRPC procedure
- Duplicating endpoint DTO schemas in a separate `input.ts` / `output.ts` when only one endpoint uses them
- Single-consumer guards or existence checks — use `_helpers/` instead; see **Existence checks** in @.cursor/rules/backend/database-query-patterns.mdc

## Existence checks and guards

- **Do not** call another `internal-functions/queries/get-*-by-id` (or cross-module `get-*-by-id`) only to verify a row exists.
- **Same module, single consumer** → minimal `select` inline or in `_helpers/` next to the endpoint or `internal-functions/mutations/<name>/`.
- **Cross-module** → small `external-functions/queries/<exists-or-check>/`, not full entity fetchers.

## Mutations

- Endpoints own `ctx.db.transaction(...)`
- `internal-functions/mutations/` receive required `trx: Transaction` — no nested transaction when called from an endpoint
- Context IDs (`mentorId`, `userId`, …) are separate arguments, not Zod input fields

## Cross-module

- Other modules → `external-functions/`, never `internal-functions/`
- See .agents/skills/algo-backend-create-endpoint/SKILL.md for read patterns in endpoints
