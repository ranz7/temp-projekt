# Security audit checklist

OWASP + project-specific audit of the given diff. Follow the procedure in
`security-procedure.md` (sibling file) end-to-end, plus the AlgoAcademy-specific checks below.

## Backend

- `protectedProcedure([PERMISSIONS])` is used for every state-mutating endpoint, with explicit permission list (never `protectedProcedure([])`).
- Resource ownership: `UPDATE` / `DELETE` endpoints verify `authorId === ctx.session.user.id` (or equivalent) before mutation, unless permission grants global access.
- Zod schemas are bounded:
  - `z.string().min(1).max(N)` — no unbounded strings
  - `z.array(...).max(N)` — no unbounded arrays
  - `z.number().int().min().max()` — no unbounded numbers
- Webhook signature verification: Stripe webhooks call `stripe.webhooks.constructEvent` BEFORE any DB write.
- No raw SQL with string interpolation. Use Drizzle query builder or `sql\`...\`` template tags only.
- Every `db.delete()` and `db.update()` has `.where()` (no linter for this — must be checked manually).

## Frontend

- No secrets in client bundle: env vars accessed in client components must be `NEXT_PUBLIC_*`.
- `dangerouslySetInnerHTML` used only with sanitized content. Flag every occurrence.
- File uploads validate size and MIME type.

## Logging / observability

- No PII in log lines (HyperDX): no emails, tokens, passwords, raw payloads.
- Use boolean/count summaries: `hasContactEmail: true`, `reviewCount: 3`.

## Output format

```markdown
## CRITICAL (security risk — block merge)
- [<area>] <file:line> — <vulnerability> → <remediation>

## HIGH
- ...

## MEDIUM
- ...

## INFO
- ...
```

If clean: `## Clean — no security findings`.

Do NOT make edits. Audit only.
