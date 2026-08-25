# Web design audit checklist (design-system compliance)

Audit the given UI files against the design system and web interface guidelines. Deeper notes:
`web-design-notes.md` (sibling file); rules `.cursor/rules/frontend/design-system-first.mdc`,
`use-colors-from-globals.mdc`, `avoid-using-margins.mdc`, `conditional-CSS.mdc`,
`heroicons.mdc`. Optionally fetch
`https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` at
the start of the review.

## Priority checklist

### Accessibility (delegate deeper a11y to the accessibility checklist)
- Semantic HTML (`<button>` not `<div onClick>`).
- Focus-visible states on every interactive element.
- `aria-label` on icon-only buttons.
- Skip-to-content link on main layouts.
- Status never communicated by color alone.

### Forms
- Every input has an associated `<label htmlFor>`.
- Submit buttons are `<button type="submit">` inside a `<form>`.
- Inline validation adjacent to the field.
- Disabled state communicated visually (opacity + `cursor-not-allowed`).
- Modal forms autofocus the first field.

### Animation & motion
- `prefers-reduced-motion` respected.
- Page transitions minimal and purposeful.
- Loading spinners carry `aria-label="Loading"`.
- Skeleton loaders match final content dimensions.

### Typography & spacing
- Type scale from design system, never ad-hoc `text-[14px]`.
- Body line-height 1.5.
- Max line width ~65–75ch for readability.
- Touch targets ≥44px.

### Images & media
- `next/image` with explicit dimensions or `fill`.
- Informational images have `alt`. Decorative: `alt=""`.

### Dark mode
- Colors come from `globals.css` CSS variables — no `bg-blue-500` style Tailwind defaults.
- Audit in both light and dark. 4.5:1 contrast in both.

### Navigation
- `<Link href>` over `router.push()` for simple links.
- Active state on current nav item.
- Breadcrumbs for nested routes >2 levels.

### Component hierarchy
- Design system first, then HeadlessUI, then shadcn, then custom. Flag any custom component that duplicates a design-system capability.

## Output format

```markdown
## Web design audit: <file or scope>

### Findings
| Category | Issue | File:line | Severity |
|---|---|---|---|
| Forms | Missing label for email input | apps/algoacademy/src/app/.../Form.tsx:42 | CRITICAL |

### Recommendations
1. <specific fix with code sketch>
```

If clean: `## Clean — no design-system findings`.

Do NOT edit. Audit only.
