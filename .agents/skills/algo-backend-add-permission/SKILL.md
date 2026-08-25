---
name: algo-backend-add-permission
description: Add a new permission to the RBAC system (module permissions.ts + PERMISSIONS aggregation + role assignment)
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(ls:*)
---

`$ARGUMENTS` = `<MODULE>.<RESOURCE>.<ACTION>.<SCOPE>` (e.g. `COURSE.LESSON.MANAGE.OWNED`). Unclear → ask.

1. Open or create `packages/backend/src/modules/<module>/permissions.ts` (mirror `course/permissions.ts`).
2. Reuse level names already in 2–3 modules (`NONE`, `DEFAULT`, `OWNED`, `ASSIGNED`, …). Lowest level whose `description` covers the action.
3. `dbName`: `MODULE__RESOURCE__ACTION__SCOPE`. Must match `PERMISSIONS.*.*.*` position.
4. `permissionGroupName`, `name`, `description` — Polish, existing tone.
5. Spread into `packages/backend/src/permissions.ts` (see that file's JSDoc).
6. Assign minimum level per role in the role seed (`seedRoles`).
7. Gate the procedure: `protectedProcedure([PERMISSIONS.<RESOURCE>.<ACTION>.<SCOPE>])`.
8. Update the procedure's permission matrix in integration tests. Missing factory → `packages/backend/src/__tests__/test-factories/<module>.ts`.

Remind: `bun run db:seed` locally; prod seed is idempotent on deploy. No commit, no migrations.
