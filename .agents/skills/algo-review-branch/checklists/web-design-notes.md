---
name: review-web-design
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review UI", "check UX", "audit design", "web design review", "UI best practices".
---

# Review Web Design

Audit UI components against the Web Interface Guidelines for modern, accessible, and user-friendly web design.

## Steps

1. Fetch the latest Web Interface Guidelines from:
   `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
   using the WebFetch tool.
2. Read the files specified by the user for review.
3. Check each component against the guidelines categories below.
4. Report findings organized by category with specific fix suggestions.

## Categories to Check

### Accessibility
- Semantic HTML (`<button>` not `<div onClick>`, `<nav>` not `<div class="nav">`)
- Focus visible states on all interactive elements
- ARIA labels on icon-only buttons
- Skip-to-content link on main layouts
- Color not as the only indicator of state

### Forms
- Every input has an associated `<label>` with `htmlFor`/`id` pairing
- Submit buttons are `<button type="submit">` inside `<form>`
- Inline validation errors adjacent to the field
- Disabled state clearly communicated (opacity + cursor)
- Autofocus on the first field of modal forms

### Animation & Transitions
- `prefers-reduced-motion` respected for all animations
- Page transitions use minimal, purposeful motion
- Loading spinners have `aria-label="Loading"`
- Skeleton loaders match content layout dimensions

### Typography & Spacing
- Consistent type scale from design system
- Line height 1.5 for body text
- Maximum line width ~65-75 characters for readability
- Sufficient spacing between interactive targets (44px minimum touch)

### Images & Media
- `next/image` with explicit dimensions or `fill`
- Alt text on all informational images
- Decorative images use `alt=""`
- Lazy loading for below-fold images (default in next/image)

### Dark Mode
- Uses CSS variables from `globals.css` not hardcoded colors
- Tested in both light and dark modes
- Sufficient contrast ratios in both modes (4.5:1 for text)

### Navigation
- `<Link href>` for navigation, not `router.push()` for simple links
- Active state on current navigation items
- Breadcrumbs for nested routes deeper than 2 levels

## Output Format

```
## Web Design Review: {filename}

### Findings
| Category | Issue | Line | Severity |
|----------|-------|------|----------|
| Forms | Missing label for email input | 42 | Critical |
| A11y | div used instead of button | 18 | Critical |
| Animation | No reduced-motion check | 55 | Warning |

### Recommendations
1. Specific fix with code example
2. ...
```
