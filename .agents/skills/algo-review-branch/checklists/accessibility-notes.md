---
name: review-accessibility
description: Review code for accessibility compliance. Use when asked to "check accessibility", "a11y review", "audit accessibility", "WCAG check", "screen reader".
---

# Review Accessibility

Audit components for WCAG 2.1 AA compliance with focus on semantic HTML, keyboard navigation, and screen reader support.

## Steps

1. Read the files specified by the user for review.
2. Check each component against the rules below.
3. Report issues with WCAG criteria references and specific fixes.

## Rules to Check

### Semantic HTML (WCAG 1.3.1)
- Use `<button>` for actions, `<a>` for navigation — never `<div onClick>`
- Use `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>` for page landmarks
- Use heading hierarchy (`<h1>` → `<h2>` → `<h3>`) without skipping levels
- Use `<ul>`/`<ol>` for lists, not styled `<div>` sequences

### Interactive Elements (WCAG 2.1.1)
- All interactive elements reachable via keyboard (Tab, Shift+Tab)
- Custom components handle Enter and Space for activation
- Escape key closes modals, dropdowns, and popovers
- Focus order follows visual layout (no positive `tabIndex`)
- Visible focus indicator on all interactive elements (`focus-visible`)

### ARIA (WCAG 4.1.2)
- Icon-only buttons must have `aria-label`: `<button aria-label="Close"><XIcon /></button>`
- Loading states use `aria-busy="true"` on the container
- Dynamic content updates use `aria-live="polite"` (or `"assertive"` for errors)
- Form errors use `aria-describedby` linking error message to input
- Modals have `role="dialog"` and `aria-modal="true"` (HeadlessUI Dialog handles this)

### Forms (WCAG 1.3.1, 3.3.2)
- Every `<input>` has a `<label>` with matching `htmlFor`/`id`
- Required fields marked with `aria-required="true"` or visual indicator
- Error messages programmatically associated with `aria-describedby`
- Group related inputs with `<fieldset>` and `<legend>`

### Focus Management (WCAG 2.4.3)
- Modal dialogs trap focus inside when open
- Focus moves to modal on open, returns to trigger on close
- Skip-to-content link as first focusable element on pages
- After route changes, focus moves to main content or page heading

### Color & Contrast (WCAG 1.4.3)
- Text contrast ratio at least 4.5:1 (3:1 for large text)
- Information not conveyed by color alone (add icons, text, or patterns)
- Verified in both light and dark modes

### HeadlessUI Components
- HeadlessUI `Dialog`, `Menu`, `Listbox`, `Combobox` have built-in ARIA — use them over custom implementations
- Still verify: focus trap, escape handling, aria-label on triggers

## Output Format

```
## Accessibility Review: {filename}

### Critical (Must Fix)
1. **[WCAG X.X.X]** (line N): Description
   **Fix:** Code example

### Warnings (Should Fix)
1. **[WCAG X.X.X]** (line N): Description
   **Fix:** Code example

### Score: X/10
```
