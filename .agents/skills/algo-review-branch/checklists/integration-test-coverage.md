# Integration test coverage audit

Audit-only pass: list untested scenarios for the endpoints in the given diff — do NOT create
test files (tests are written only when explicitly requested; authoritative pattern:
`.cursor/rules/backend/integration-testing-patterns.mdc`).

## Permission matrix — expect all four per tRPC endpoint

| Scenario | Caller | Expected |
|---|---|---|
| No session | `asAnonymous()` | `UNAUTHORIZED` |
| Missing perm | `asUser([])` | `FORBIDDEN` |
| Owner / has perm | `asUser(['PERM'], { id })` | Success |
| Not owner (when ownership applies) | `asUser(['PERM'])` with different id | `FORBIDDEN` |

Plus, where applicable: `NOT_FOUND` (non-existent ID) and `BAD_REQUEST` (one Zod validation
example per schema).

## What to check

1. For every endpoint touched in the diff, find its tests: co-located `__tests__/<endpoint>.integration.test.ts` or module-level `packages/backend/src/modules/<module>/__tests__/<behavior>.integration.test.ts`.
2. Report which matrix rows are missing per endpoint.
3. Check factories exist for seeded entities (`packages/backend/src/__tests__/test-factories/<module>.ts` — flat files); note missing factories.
4. Flag tests that mock the database or test roles instead of permissions — both violate project rules.

## Output format

```markdown
## Test coverage audit

### Missing coverage (per endpoint)
- `<module>.<endpoint>` — missing: FORBIDDEN, NOT_FOUND
- ...

### Rule violations in existing tests
- <file:line> — <violation>

### Missing factories
- ...
```

If complete: `## Clean — coverage complete for all touched endpoints`.
