# Design notes — v3.1

The paper system already existed. These notes cover what v3.1 changed and the rules it follows.
Sources are public design references; they were **read and applied**, not installed as custom
skills (custom skill installation is not available on this account).

- `ui-skills.com/skills/jakubkrehel/better-interface` — evidence-based interface review,
  accessibility/layout/type/colour as separate owners, escalation triggers.
- `github.com/dickwu/apple-design-skill` — Apple HIG translated for the web: agency, familiarity,
  flexibility, simplicity, craft, delight; platform conventions; motion and transparency settings.
- `github.com/emilkowalski/skill` — animation decisions: correct easing direction, short
  durations, transform/opacity, never animate what does not explain change.

## The checklist this build was reviewed against

### Accessibility (blocking)

- Every icon button has an accessible name (`aria-label` or visible text).
- Every control keeps the global `:focus-visible` ring (`3px` tomato, 2px offset).
- Auth tabs use `role="tablist"` / `role="tab"` with `aria-selected`; the panel is labelled.
- Form errors are `role="alert"`; successful sign-in uses `role="status"`.
- The splash is `role="status"` and hands over automatically. It never traps focus.
- Reduced motion disables all decorative animation through the existing global rule.

### Layout

- Mobile: single column, auth becomes a bottom sheet, nav stays a five-tab bar.
- Tablet: auth keeps two columns down to 901 px, then collapses.
- Desktop ≥1120 px: the place sheet becomes a centred two-panel popup; the photo keeps its
  aspect and height instead of being cropped smaller.
- Large ≥1440/1680/2100 px: shell widens (1720 → 1900 → 2120), deck widens (540 → 580 → 620),
  cravings grid reaches three columns. No text is scaled down to fit.

### Typography and colour

- No new palette. Teal boards reuse the illustration's own ground; cream, kraft, tomato, forest
  and mustard are the existing tokens.
- Titles use `--font-head`; body uses Nunito. Numerals in stats are tabular.
- Contrast: cream on forest/tomato, ink on paper; subdued copy only for secondary metadata.

### Motion

| Element | Motion | Why |
| --- | --- | --- |
| Splash exit | opacity + 1.5% scale, 560–620 ms | separates app launch from content |
| Splash bowl | 10 px float, 5.2 s | breathing room while the shell warms |
| Auth cut-outs | 10 px drift over 11 s, staggered | paper on a board, not a carousel |
| Skeleton shimmer | background-position, 1.7 s | signals loading without layout shift |
| Dialog entry | translateY 22 px + scale 0.97, 280 ms | spatial origin at the bottom edge |
| Toast / badge | existing v3 motion | unchanged |

All motion is transform/opacity or background-position. No width/height/top/left animation.

### Writing

- Buttons say what happens: “Create my account”, “Delete permanently”, “Browse as a guest”.
- Failure copy names the recovery: “No demo account for that email yet. Create one first.”
- The demo mode is never disguised as real authentication.

### Auth-specific craft

- The destructive path requires typing `DELETE`; the primary action stays disabled until it
  matches, and the safe action is the wide, quiet one.
- The auth card is the only bright surface on a dark board, so the eye lands on the form.
- Clerk's own component keeps its verified flow; we only theme it and hide its duplicate header.

## Source links

- <https://www.ui-skills.com/skills/jakubkrehel/better-interface>
- <https://github.com/dickwu/apple-design-skill>
- <https://github.com/emilkowalski/skill>
