# Accessibility audit checklist (WCAG 2.1 AA)

Audit the given frontend files for accessibility. Deeper notes: `accessibility-notes.md`
(sibling file) and `.cursor/rules/advanced/accessibility-best-practices.mdc`.

## Priority checklist

1. **Semantic HTML (1.3.1)** — `<button>` for actions, `<a>` for navigation, never `<div onClick>`. Landmarks (`<nav>`, `<main>`, `<section>`). Heading hierarchy without skipping levels. `<ul>`/`<ol>` for lists.
2. **Keyboard (2.1.1)** — every interactive element reachable via Tab. Enter + Space activate custom controls. Escape closes overlays. No positive `tabIndex`. Visible `focus-visible` indicator.
3. **ARIA (4.1.2)** — `aria-label` on icon-only buttons. `aria-busy` on loading containers. `aria-live="polite"` for dynamic updates (`"assertive"` for errors). `aria-describedby` linking error messages to inputs. `role="dialog"` + `aria-modal` for modals (HeadlessUI Dialog handles this).
4. **Forms (1.3.1, 3.3.2)** — every `<input>` has a `<label htmlFor>`. Required fields marked with `aria-required`. Errors associated via `aria-describedby`. Grouped inputs use `<fieldset>` + `<legend>`.
5. **Focus management (2.4.3)** — modals trap focus, move focus on open, return on close. Skip-to-content link first-focusable on pages. Route changes move focus to `<main>` or page heading.
6. **Color / contrast (1.4.3)** — text ≥ 4.5:1 (3:1 for large). Information never conveyed by color alone (pair with icon/text/pattern). Check light AND dark mode (colors must come from `globals.css` CSS variables).
7. **HeadlessUI composites** — prefer HeadlessUI `Dialog`/`Menu`/`Listbox`/`Combobox` over custom; they ship correct ARIA by default. If custom, verify focus trap + escape + label.

## Output format

```markdown
## Accessibility audit: <file or scope>

### CRITICAL (WCAG blocker)
- [<WCAG ref>] <file:line> — <issue> → <fix>

### HIGH
- ...

### MEDIUM
- ...

### INFO
- ...

### Score: X/10
```

If clean: `## Clean — no a11y findings`.

Do NOT edit. Audit only.
