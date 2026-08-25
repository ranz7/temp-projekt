---
name: review-security
description: Review code for security vulnerabilities. Use when asked to "check security", "security review", "audit security", "security vulnerabilities", "security check".
---

# Review Security

Audit code for security vulnerabilities in tRPC procedures, database queries, authentication, and data handling.

## Steps

1. Read the files specified by the user for review.
2. Check backend code against input validation, authorization, and data exposure rules.
3. Check frontend code against XSS, sensitive data, and environment variable rules.
4. Report findings with severity and specific remediation steps.

## Backend Rules

### Input Validation
- Every tRPC procedure input MUST have a Zod schema in `input.dto.ts`
- Validate string lengths: `z.string().min(1).max(1000)` — never unbounded strings
- Validate numeric ranges: `z.number().int().positive().max(MAX)` — never unbounded numbers
- Validate email format: `z.string().email()`
- Validate UUIDs: `z.string().uuid()`
- Arrays must have `z.array().max(100)` — never unbounded arrays

### Authorization
- Every non-public procedure MUST use `protectedProcedure([PERMISSIONS...])`
- Never use `publicProcedure` for operations that modify data unless explicitly intended (e.g., registration)
- Check resource ownership in OWNED-level permission handlers
- Never trust client-provided user IDs — use `ctx.session.user.id` from the server session

### Database Security
- Always use Drizzle ORM query builder — never raw SQL string concatenation
- Use parameterized queries when raw SQL is unavoidable: `sql\`SELECT * FROM users WHERE id = ${userId}\``
- Use transactions for multi-step mutations: `db.transaction(async (tx) => { ... })`
- Never return password hashes, tokens, or secrets in query results

### Data Exposure
- Use `output.dto.ts` with Zod `.pick()` or `.omit()` to restrict response fields
- Strip sensitive fields before returning: passwords, tokens, internal IDs
- Log errors server-side but return generic messages to clients

## Frontend Rules

### XSS Prevention
- Never use `dangerouslySetInnerHTML` without sanitization (use DOMPurify if needed)
- Sanitize user-generated content before rendering as HTML
- Use React's built-in escaping (JSX `{}` expressions) for dynamic content

### Environment Variables
- Only `NEXT_PUBLIC_` variables are safe for client-side code
- Server-only secrets (DB credentials, API keys) must NEVER have `NEXT_PUBLIC_` prefix
- Access server secrets only in server components, API routes, or tRPC procedures
- Verify `.env.example` documents all required variables without actual values

### Authentication
- Use the project BetterAuth helpers: `getUser()` in Server Components and `resolveUserFromHeaders(request.headers)` in route handlers
- Use `auth.api.getSession({ headers })` only when the raw BetterAuth session is required
- Never store auth tokens in localStorage — use the httpOnly cookies managed by BetterAuth
- Verify session on every protected page/API route

## Output Format

```
## Security Review: {filename}

### Critical Vulnerabilities
1. **[Category]** (line N): Description
   **Risk:** What could go wrong
   **Fix:** Code example

### Warnings
1. **[Category]** (line N): Description
   **Fix:** Code example

### Checklist
- [ ] Input validation on all endpoints
- [ ] Authorization on all protected endpoints
- [ ] No sensitive data in responses
- [ ] No raw SQL string concatenation
- [ ] Environment variables properly scoped
```
