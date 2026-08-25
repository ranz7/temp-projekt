# Code review checklist (general conventions)

Senior-reviewer pass over the given diff. Authoritative sources for what's "correct": root
`CLAUDE.md`, `.cursor/rules/rules-index.mdc`, and the per-area `CLAUDE.md` files
(`packages/backend/src/`, `apps/algoacademy/src/`, `apps/algoacademy/src/app/`,
`packages/design-system/`).

## Priority checklist (in order)

1. **Database safety** — every `db.delete()` / `db.update()` in the diff has a `.where()` clause.
2. **Authorization** — every new tRPC procedure uses `protectedProcedure([PERMISSIONS])` (never bare `publicProcedure` for state-mutating ops). Ownership checks present where the resource has `authorId`/`createdBy`/etc.
3. **Input validation** — every tRPC input has a Zod schema in `input.dto.ts`. Strings/arrays/numbers are bounded (`.max()`).
4. **Test coverage** — integration tests cover UNAUTHORIZED / FORBIDDEN / OWNED / NOT_FOUND / SUCCESS.
5. **Type safety** — no `any`, no `as` assertions, no `@ts-ignore` / `@ts-expect-error`.
6. **Performance** — no sequential `await`s where `Promise.all` would work. No barrel imports.
7. **Frontend** — design-system-first hierarchy followed. No `useEffect` for derived state. Colors from `globals.css`, not Tailwind defaults.
8. **Logging** — no PII in log lines (no emails, tokens, passwords, raw payloads).

## Output format

```markdown
## Critical (must fix before merge)
- [<area>] <file:line> — <issue> → <fix>

## Important (should fix)
- ...

## Nitpicks (optional)
- ...
```

If the change is clean, say so explicitly: `## Clean — no findings`.

Do NOT make edits. Do NOT run tests. Review only.
