---
name: review-react-performance
description: Review React code for performance issues. Use when asked to "review performance", "check performance", "optimize", "performance audit", "slow rendering".
---

# Review React Performance

Audit React components and patterns for common performance pitfalls specific to this Next.js project.

## Steps

1. Read the `AGENTS.md` file in this skill directory for the full 40+ rules catalog.
2. Read the files specified by the user for review.
3. Check each file against the rules below and report findings with severity (critical/warning/info).
4. Provide specific fix suggestions with code examples.

## Rules to Check

### Critical

- **Sequential awaits**: Replace `await a(); await b();` with `const [a, b] = await Promise.all([a(), b()])` when requests are independent
- **Barrel imports**: Avoid importing from `index.ts` barrel files — import directly from the source file
- **Client components with no interactivity**: Remove `'use client'` if the component has no hooks, event handlers, or browser APIs
- **State in URL**: Search filters, pagination, and tabs should use `searchParams` not `useState`
- **Derived state via useEffect**: If state can be computed from props or other state, calculate it during render instead of using `useEffect` + `setState`

### Warning

- **Missing dynamic imports**: Heavy components (editors, charts, maps) should use `next/dynamic` with `ssr: false`
- **Unnecessary useMemo/useCallback**: Don't memoize unless there's a measured performance problem or expensive computation
- **Large component trees re-rendering**: Check if state can be lifted into a more isolated component to limit re-render scope
- **Missing Suspense boundaries**: Async components should be wrapped in `<Suspense>` with meaningful fallbacks
- **Inline object/array creation in JSX**: `style={{}}` or `options={[]}` in render creates new references every render

### Info

- **Image optimization**: Use `next/image` instead of `<img>`, specify `width` and `height` or use `fill`
- **Font optimization**: Use `next/font` instead of external font links
- **Missing `key` prop or using index as key**: Use stable unique IDs for list keys

## Output Format

```
## Performance Review: {filename}

### Critical Issues
1. **[Rule Name]** (line X): Description of the issue
   **Fix:** Code suggestion

### Warnings
1. **[Rule Name]** (line X): Description
   **Fix:** Code suggestion

### Summary
- Critical: N issues
- Warnings: N issues
- Score: X/10
```
