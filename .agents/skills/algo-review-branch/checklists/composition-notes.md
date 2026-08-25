---
name: review-composition-patterns
description: Review React component architecture and composition patterns. Use when asked to "review patterns", "check component architecture", "composition review", "refactor component".
---

# Review Composition Patterns

Audit React component architecture for composition best practices, prop design, and structural patterns.

## Steps

1. Read the `AGENTS.md` file in this skill directory for the full composition patterns rule set.
2. Read the files specified by the user for review.
3. Check each component against the patterns below.
4. Report issues with specific refactoring suggestions and code examples.

## Patterns to Check

### Boolean Prop Explosion

When a component has 3+ boolean props controlling variants, refactor to a single `variant` prop or compound component pattern.

```tsx
// Problem: boolean prop explosion
<Card isCompact isPrimary isOutlined hasHeader hasFooter />

// Fix: variant + compound components
<Card variant="compact-primary-outlined">
  <Card.Header>...</Card.Header>
  <Card.Footer>...</Card.Footer>
</Card>
```

### Render Props Overuse

Replace render props with children or slot-based composition.

```tsx
// Problem: render prop
<DataTable renderRow={(row) => <CustomRow data={row} />} />

// Fix: children composition
<DataTable>
  {(rows) => rows.map((row) => <CustomRow key={row.id} data={row} />)}
</DataTable>
```

### State Management Location

- State used by one component: keep local
- State shared by siblings: lift to parent
- State shared across distant components: use React Context with a provider
- Server state: use tRPC queries, not local state

### Component Size

- Components over 150 lines should be split into smaller focused components
- Extract custom hooks when a component has 3+ `useState`/`useEffect` calls
- Each component should have a single responsibility

### Props Design

- Use options objects for 4+ props (see CLAUDE.md conventions)
- Required props first, optional with defaults after
- Prefer `children` over content/render props for slot-based composition
- Avoid prop drilling more than 2 levels — use Context

### React 19 Patterns

- Use `use()` hook for promises and context instead of `useContext`
- Use server actions with `useActionState` for form mutations
- Use `useOptimistic` for optimistic UI updates

## Output Format

```
## Composition Review: {filename}

### Issues Found
1. **[Pattern]** (line X): Description
   **Current:** Brief description of current code
   **Suggested:** Code example of the fix

### Component Health
- Composition: Good/Needs Work
- Props Design: Good/Needs Work
- State Management: Good/Needs Work
```
