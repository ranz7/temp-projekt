# React performance audit checklist

Audit React performance in the given files. React Compiler is enabled project-wide — most
manual memoization is unnecessary; focus on issues the compiler can NOT fix. Deeper notes:
`react-performance-notes.md` and the 40+ rule catalog `react-performance-rules.md` (sibling
files); rules `.cursor/rules/advanced/react-performance-optimization.mdc`,
`no-sequential-awaits.mdc`, `no-barrel-imports.mdc`, `derived-state-not-effect.mdc`,
`server-component-data-fetching.mdc`.

## Priority checklist

### CRITICAL (blocker-level regressions)

1. **Sequential awaits in RSC** — independent `await a(); await b();` → `const [a, b] = await Promise.all([...])`.
2. **Barrel imports** — `from '@algoacademy/design-system/web'` breaks tree-shaking; use the direct path.
3. **Client component with no interactivity** — `'use client'` without hooks / events / browser API → remove it.
4. **URL state stored in React state** — filters, pagination, tabs belong in `searchParams`, not `useState`.
5. **Derived state via `useEffect`** — computing state from props + `setState` in effect. Derive during render.

### HIGH

6. **Missing `<Suspense>` boundary** — async Server Components lacking a fallback will block the entire route.
7. **Inline object / array props crossing a `React.memo` or third-party library boundary** — new reference each render; wrap with `useMemo` ONLY at that boundary.
8. **Un-virtualized long lists** — 100+ rows rendered eagerly → virtualize or paginate.
9. **Waterfall client fetches** — dependent `useQuery` chains that could be a single prefetched RSC query or `Promise.all` on the server.

## Output format

```markdown
## React performance audit: <file or scope>

### CRITICAL
- <file:line> — <issue> → <fix>

### HIGH
- ...

### INFO
- ...
```

If clean: `## Clean — no performance findings`.

Do NOT edit. Audit only.
