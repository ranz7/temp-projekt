# Composition review checklist (React architecture)

Review React component architecture in the given files. Deeper notes: `composition-notes.md`
and the full rule catalog `composition-rules.md` (sibling files); rules
`.cursor/rules/frontend/compound-component.mdc`, `no-boolean-props-explosion.mdc`,
`separate-files-for-components.mdc`.

## Priority checklist

1. **Boolean prop explosion** — 3+ boolean variant props collapse to a `variant` prop or compound subcomponents (`Card.Header`, `Card.Footer`).
2. **Render-prop overuse** — replace with children or slot-based composition where the API supports it.
3. **State placement** — local for single-component use, lifted for siblings, Context for distant consumers, tRPC queries for server state (never `useState` for server state).
4. **Component size** — >150 lines should split. >3 `useState`/`useEffect` in one component → extract custom hook.
5. **Props design** — required first + optional-with-default after. 4+ props → consider options object. `children` over render-prop for slot composition. Prop-drilling >2 levels → Context.
6. **React 19 patterns** — `use()` for promises + context (instead of `useContext` where natural). `useActionState` for form mutations. `useOptimistic` for optimistic UI.
7. **File hygiene** — one component per file. Named exports only. Sub-components live in a sibling `_components/` folder, not inlined after 100 lines of JSX.

## Output format

```markdown
## Composition review: <file or scope>

### Refactor candidates (high-impact)
1. **[<pattern>]** <file:line> — <current problem>
   **Suggested:** <code sketch of fix>

### Smaller improvements
- ...

### Component health
- Composition: Good / Needs work
- Props design: Good / Needs work
- State placement: Good / Needs work
```

If clean: `## Clean — no composition findings`.

Do NOT edit. Review only.
