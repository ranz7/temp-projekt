# Permission examples — docs module

Read when picking a gate/branch pattern for `algo-backend-create-endpoint`.

Docs has two permission trees in `modules/docs/permissions.ts`:

- **`KNOWLEDGE_BASE`** — articles/modules content (view published, manage articles, archive, all versions).
- **`COLLECTION`** — collection CRUD, user/role assignments, publishing collections, admin view.

### Example A — public query, response varies by manage access

**`getCollection`** — read collection structure. Viewers see published-only; managers see drafts.

- Read `KNOWLEDGE_BASE.VIEW.*` → public users with `DEFAULT_OR_ASSIGNED` see assigned + public collections (published).
- Read `KNOWLEDGE_BASE.MANAGE.ASSIGNED` description → "tworzenie/edycja/archiwizacja artykułów w **przypisanych** kolekcjach" + drafts.
- Read `COLLECTION.MANAGE.ASSIGNED` / `ALL` → collection-level manage (also grants manage via `ensureCanManageCollection`).

```typescript
// publicProcedure — no hard gate
// Branch: ensureCanManageCollection → full structure vs filterPublicOnlyModulesAndArticles
export const getCollectionProcedure = publicProcedure
  .input(GetCollectionInputDTOZ)
  .query(async ({ ctx, input }) => {
    // ...
    let userCanManageCollection = false
    if (!input.publicOnly) {
      try {
        await ensureCanManageCollection({ collectionId: collection.id }, ctx)
        userCanManageCollection = true
      } catch {
        userCanManageCollection = false
      }
    }
    // userCanManageCollection ? sortAndProjectModules : filterPublicOnlyModulesAndArticles
  })
```

**Why not `protectedProcedure`?** Anonymous and logged-in readers must access published content. Permission only changes **return shape**, not access to the endpoint.

### Example B — public list, multiple VIEW/MANAGE branches

**`getAllCollections`** — list collections without modules/articles.

| Caller | `input.isPublic` | Permission (from description) | Behavior |
|---|---|---|---|
| Anyone | `true` | none / below VIEW | public collections only |
| Logged-in | `true` | `KNOWLEDGE_BASE.VIEW.DEFAULT_OR_ASSIGNED` | public + assigned |
| Manager | `false` | `KNOWLEDGE_BASE.MANAGE.ASSIGNED` | only assigned manageable collections |
| Admin | `false` | `KNOWLEDGE_BASE.MANAGE.ALL` | all collections + assignments |

```typescript
export const getAllCollectionsProcedure = publicProcedure
  .input(GetAllCollectionsInputDTOZ)
  .query(async ({ ctx, input }) => {
    if (input.isPublic) {
      if (ctx.user.hasPermissions([DOCS__PERMISSIONS.KNOWLEDGE_BASE.VIEW.DEFAULT_OR_ASSIGNED])) {
        return { allCollections: await getAllPublicOrAssignedCollections(ctx) }
      }
      return { allCollections: await getAllPublicCollections(ctx) }
    }

    if (ctx.user.hasPermissions([DOCS__PERMISSIONS.KNOWLEDGE_BASE.MANAGE.ALL])) {
      return { allCollections: await getAllCollectionsWithAssignments(ctx) }
    }

    if (ctx.user.hasPermissions([DOCS__PERMISSIONS.KNOWLEDGE_BASE.MANAGE.ASSIGNED])) {
      return { allCollections: await getAllManagedByAssignedCollections(ctx) }
    }

    return { allCollections: [] }
  })
```

### Example C — protected mutation + ASSIGNED scope via ensure*

**`archivizeArticle`** — archive = edit article (remove from module).

- `KNOWLEDGE_BASE.MANAGE.ASSIGNED` description: "tworzenie/edycja/archiwizacja artykułów w **przypisanych** kolekcjach".
- Minimum gate: `protectedProcedure([KNOWLEDGE_BASE.MANAGE.ASSIGNED])`.
- ASSIGNED users still need collection assignment → `ensureCanManageKnowledgeBase({ articleId })`.

```typescript
export const archivizeArticleProcedure = protectedProcedure([
  DOCS__PERMISSIONS.KNOWLEDGE_BASE.MANAGE.ASSIGNED
])
  .input(ArchivizeArticleInputDTOZ)
  .mutation(async ({ input, ctx }) => {
    await ensureCanManageKnowledgeBase({ articleId: input.articleId }, ctx)
    // ... update docs__article_
  })
```

Same pattern: `getAllArticleVersions`, `insertArticleVersionByArticleId`, `upsertArticleSettings`.

### Example D — protected mutation + branching inside handler

**`upsertCollection`** — create/edit collection metadata.

- `COLLECTION.MANAGE.ASSIGNED` description: "tworzenie kolekcji i edytowanie **przypisanych** kolekcji" — minimum gate.
- `COLLECTION.MANAGE.ALL` description adds: "zarządzanie rolami i użytkownikami", "publikowanie wszystkich kolekcji", "widok admina".

```typescript
export const upsertCollectionProcedure = protectedProcedure([
  DOCS__PERMISSIONS.COLLECTION.MANAGE.ASSIGNED
])
  .mutation(async ({ input, ctx }) => {
    const canManageAll = ctx.user.hasPermissions([DOCS__PERMISSIONS.COLLECTION.MANAGE.ALL])

    if (input.collection.id && !canManageAll) {
      await ensureCanManageCollection({ collectionId: input.collection.id }, ctx)
    }

    if (!canManageAll && (input.rolesAccess?.length || input.usersIdsAccess?.length)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Nie masz uprawnień do wykonania tej akcji' })
    }
    // ...
  })
```

**Lesson:** gate = minimum (`ASSIGNED`); **`MANAGE.ALL` unlocks extra input fields** (role/user access) per description.

### Example E — action matches only ALL level

**`updateCollectionPublication`** — toggles `is_public_` on collection.

- Only `COLLECTION.MANAGE.ALL` description mentions publishing all collections.
- Use `protectedProcedure([COLLECTION.MANAGE.ALL])` — no `ensure*`, no ASSIGNED fallback.

### Example F — ensure* with OR across different groups

**`ensureCanManageCollection`** — used by many endpoints when ASSIGNED scope applies.

- OR across **`COLLECTION.MANAGE.*`** and **`KNOWLEDGE_BASE.MANAGE.*`** is valid — different groups, either grants manage capability.
- Within each group: check minimum (`ASSIGNED` or `ALL`), not OR of both levels.

```typescript
const hasAnyManageAll =
  ctx.user.hasPermissions([DOCS__PERMISSIONS.COLLECTION.MANAGE.ALL]) ||
  ctx.user.hasPermissions([DOCS__PERMISSIONS.KNOWLEDGE_BASE.MANAGE.ALL])

if (!hasAnyManageAll) {
  const { canManage } = await getPermissionToManageTheCollectionIdByUserId(...)
  if (!canManage) throw new TRPCError({ code: 'FORBIDDEN', ... })
}
```

Extract to `internal-functions/queries/ensure-can-manage-*/` when reused by 2+ endpoints.

### Example G — public single resource, silent manage check

**`getArticle`** — article detail page.

- Public readers: published version only (`publishedVersionId` required).
- Managers (`ensureCanManageCollection`): also `latestVersion` (draft).

Same try/catch + boolean flag pattern as `getCollection`.

---

