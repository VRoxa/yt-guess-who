# Component Style Guide

> This document is the authoritative visual specification for every reusable UI primitive in YtGuessWho.
> Every value is concrete and implementation-ready. The Dev must not introduce spacing, color, or typographic
> values that are not defined here or in `docs/design/look-and-feel.md` and `docs/design/color-palette.md`.

---

## 1. Typography

### Font imports

Two typefaces are used. Both are loaded from Google Fonts in `src/index.html` (or via `@import` in `styles.scss`).

```
Syne           — weights 700, 800   — display headings, Jam code label
Inter          — weights 400, 500, 600   — all body and UI text
```

Import URL:
```
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Syne:wght@700;800&display=swap
```

### Type scale

All sizes use `rem` units relative to a 16px root (`<html>` font-size). Do not override the root font-size.

| Role | Font family | Weight | Size | Line height | Letter spacing | Typical use |
|------|------------|--------|------|-------------|----------------|-------------|
| `heading-1` | Syne | 800 | `3rem` (48px) | `1.1` | `-0.02em` | Page-level titles (future screens) |
| `heading-2` | Syne | 700 | `2rem` (32px) | `1.2` | `-0.01em` | Section headings, screen titles |
| `heading-3` | Syne | 700 | `1.5rem` (24px) | `1.3` | `0` | Card headings, sub-section labels |
| `body-large` | Inter | 400 | `1.125rem` (18px) | `1.6` | `0` | Lead paragraphs, prominent body text |
| `body` | Inter | 400 | `1rem` (16px) | `1.6` | `0` | Standard body copy, descriptions |
| `label-large` | Inter | 600 | `1rem` (16px) | `1.4` | `0.01em` | Button text, input labels above fields |
| `label` | Inter | 500 | `0.875rem` (14px) | `1.4` | `0.01em` | Form field labels, chip text, tab labels |
| `caption` | Inter | 400 | `0.75rem` (12px) | `1.5` | `0.02em` | Helper text, timestamps, secondary metadata |
| `jam-code` | Inter | 800 | `5rem` (80px) | `1` | `0.25em` | The six-character Jam code display only |

### Rules
- `heading-1` through `heading-3` use Syne. All other roles use Inter.
- Do not mix font families within a single text element.
- Do not use font weights outside the imported set (400, 500, 600, 700, 800).
- The `jam-code` role is exclusively for the Jam code display component. Do not apply it elsewhere.

---

## 2. Buttons

All button variants share these base properties unless overridden in the variant section.

| Property | Value |
|----------|-------|
| Height | `48px` |
| Padding | `0 24px` |
| Border-radius | `24px` (full pill) |
| Font | `label-large` (Inter, 600, 1rem) |
| Letter spacing | `0.01em` |
| Cursor | `pointer` |
| `user-select` | `none` |
| Transition | `background-color 80ms ease-standard, opacity 80ms ease-standard, box-shadow 80ms ease-standard` |

---

### Variant: Primary

The default call-to-action. Used for "Create Jam" and any affirmative action.

| State | Background | Text color | Border | Box shadow |
|-------|-----------|------------|--------|------------|
| Default | `--color-action-primary` | `--color-action-primary-text` | none | none |
| Hover | `--color-action-primary` at 92% + 8% white overlay | `--color-action-primary-text` | none | elevation level 1 |
| Active (pressed) | `--color-action-primary` at 88% + 12% white overlay | `--color-action-primary-text` | none | none |
| Focus-visible | `--color-action-primary` | `--color-action-primary-text` | none | `0 0 0 3px --md-primary at 50%` (focus ring) |
| Disabled | `--md-on-surface` at 12% opacity | `--md-on-surface` at 38% opacity | none | none |
| Loading | Same as Default | `--color-action-primary-text` | none | none |

**Loading state:** Replace the label text with the in-progress label (e.g., "Creating…"). Do not add a spinner in V1 — the label change is the loading indicator. The button remains disabled.

---

### Variant: Secondary (Outlined)

Used for "Join Jam" and any secondary action that sits alongside a primary button.

| State | Background | Text color | Border |
|-------|-----------|------------|--------|
| Default | `transparent` | `--md-primary` | `1.5px solid --color-input-border` |
| Hover | `--md-primary` at 8% opacity | `--md-primary` | `1.5px solid --md-primary` |
| Active (pressed) | `--md-primary` at 12% opacity | `--md-primary` | `1.5px solid --md-primary` |
| Focus-visible | `transparent` | `--md-primary` | `1.5px solid --md-primary` + `0 0 0 3px --md-primary at 50%` focus ring |
| Disabled | `transparent` | `--md-on-surface` at 38% opacity | `1.5px solid --md-on-surface` at 12% opacity |
| Loading | Same as Default | `--md-primary` | `1.5px solid --color-input-border` |

---

### Variant: Ghost (Text-only)

Used for low-emphasis tertiary actions (e.g., "Cancel", navigation links styled as buttons).

| State | Background | Text color | Border |
|-------|-----------|------------|--------|
| Default | `transparent` | `--md-primary` | none |
| Hover | `--md-primary` at 8% opacity | `--md-primary` | none |
| Active (pressed) | `--md-primary` at 12% opacity | `--md-primary` | none |
| Focus-visible | `transparent` | `--md-primary` | `0 0 0 3px --md-primary at 50%` focus ring |
| Disabled | `transparent` | `--md-on-surface` at 38% opacity | none |

---

### Variant: Danger

Used for destructive actions only (none implemented in V1; specified for completeness).

| State | Background | Text color | Border |
|-------|-----------|------------|--------|
| Default | `--md-error-container` | `--md-on-error-container` | none |
| Hover | `--md-error-container` at 92% | `--md-on-error-container` | none |
| Active | `--md-error-container` at 88% | `--md-on-error-container` | none |
| Disabled | Same disabled rules as Primary variant | | |

---

### Button row layout

When two buttons appear side by side (e.g., "Create Jam" and "Join Jam"):
- Container: `display: flex; gap: 12px` (`space-3`).
- Both buttons: `flex: 1` so they share available width equally.
- On viewports narrower than `400px`: stack vertically (`flex-direction: column`).

---

## 3. Text Inputs

All text inputs (type `text`, `url`, `email`) share these base properties.

| Property | Value |
|----------|-------|
| Height | `56px` |
| Padding (inline) | `16px` (`space-4`) |
| Border | `1.5px solid --color-input-border` |
| Border-radius | `12px` |
| Background | `--color-input-bg` |
| Font | `body` (Inter, 400, 1rem) |
| Color | `--md-on-surface` |
| Width | `100%` of its container |
| `box-sizing` | `border-box` |
| Transition | `border-color 150ms ease-standard, box-shadow 150ms ease-standard` |

### Placeholder text
| Property | Value |
|----------|-------|
| Font | Inter, 400, 1rem (same as input) |
| Color | `--color-input-placeholder` at 60% opacity |
| Font style | `normal` (not italic) |

### State specifications

| State | Border | Box shadow | Notes |
|-------|--------|------------|-------|
| Default | `1.5px solid --color-input-border` | none | |
| Hover | `1.5px solid --md-on-surface-variant` | none | Subtle intensification of border |
| Focus | `2px solid --color-input-border-focus` | `0 0 0 3px --md-primary at 25%` | Removes outline; uses custom focus ring |
| Error | `2px solid --color-input-border-error` | `0 0 0 3px --md-error at 20%` | |
| Disabled | `1.5px solid --md-outline at 38% opacity` | none | Background: `--md-surface`; text: `--md-on-surface at 38%` |

### Text input outline removal
`outline: none` must be set on the `<input>` element. The focus ring is provided by the custom `box-shadow` above. Never remove focus indication entirely — this is an accessibility requirement.

---

## 4. Form Layout

### Label style

Labels appear **above** their associated input. Floating labels are not used.

| Property | Value |
|----------|-------|
| Font | `label` (Inter, 500, 0.875rem) |
| Color | `--md-on-surface-variant` |
| Display | `block` |
| Margin bottom | `8px` (`space-2`) — gap between label and its input |

### Vertical rhythm within a form

| Between | Spacing |
|---------|---------|
| Label and its input | `8px` (`space-2`) |
| One input field (including its label) and the next | `24px` (`space-6`) |
| Last input field and the button row | `32px` (`space-8`) |
| Button row and the error message area | `16px` (`space-4`) |

### Error message

Error messages appear **below** the button row (not below individual inputs, as errors in V1 are form-level, not field-level).

| Property | Value |
|----------|-------|
| Font | `caption` (Inter, 400, 0.75rem) |
| Color | `--color-danger` |
| Display | `block` |
| Margin top | `16px` (`space-4`) — gap above the error message |
| Transition | Fade in at `150ms ease-standard` |

### Form container

| Property | Value |
|----------|-------|
| Max-width | `560px` |
| Horizontal alignment | `margin-inline: auto` |
| Padding inline | `24px` (`space-6`) on small viewports; `0` when viewport is wider than the max-width |
| Padding block | `64px 48px` (`space-16` top, `space-12` bottom) |

---

## 5. Cards

Cards are used for grouping related content (e.g., the form container, player list items in the future Waiting Room).

| Property | Value |
|----------|-------|
| Padding | `24px` (`space-6`) |
| Border-radius | `16px` |
| Elevation | Level 1 (see `docs/design/look-and-feel.md` — Elevation & Depth) |
| Background | `--md-surface` |
| Border | none |

**Nested card rule:** A card must not contain another card. If nested grouping is needed, use a surface variant region (background `--md-surface-variant`, border-radius `8px`) inside the outer card.

---

## 6. Badges / Status Chips

Status chips communicate real-time state (e.g., player connection status, phase indicators in future screens).

| Property | Value |
|----------|-------|
| Shape | Pill — `border-radius: 9999px` |
| Padding | `4px 12px` (`space-1` vertical, `space-3` horizontal) |
| Font | `label` (Inter, 500, 0.875rem) |
| Font weight | 500 |
| Display | `inline-flex; align-items: center; gap: 6px` |

### Color variants

| Variant | Background | Text | Use |
|---------|-----------|------|-----|
| Neutral | `--md-surface-variant` | `--md-on-surface-variant` | Default state, player waiting |
| Success | `#1B5E20` (dark green) | `#A5D6A7` (light green) | Player ready, action confirmed |
| Warning | `#E65100` (dark amber) | `#FFE0B2` (light amber) | Partial state, waiting for others |
| Error | `--md-error-container` | `--md-on-error-container` | Error condition |

---

## 7. The Jam Code Display

The Jam code is the most important piece of information the application shows. Its visual treatment must make it the undisputed centrepiece of the screen. See also Principle 5 in `docs/design/look-and-feel.md`.

### Container

| Property | Value |
|----------|-------|
| Display | `inline-flex; flex-direction: column; align-items: center; gap: 12px` (`space-3`) |
| Background | `--color-jam-code-bg` (`--md-primary-container`) |
| Border | `2px solid --md-primary at 40% opacity` |
| Border-radius | `20px` |
| Padding | `32px 48px` (`space-8` vertical, `space-12` horizontal) |
| Box shadow | Elevation level 2 (see `docs/design/look-and-feel.md`) |
| Alignment | Horizontally centred on the page: `margin-inline: auto` |

**Glow effect (MD3 deviation):** Apply a subtle outer glow to reinforce the hero status of this element. This is a deliberate deviation from standard MD3 elevation:
```
box-shadow:
  [elevation-2 shadow],
  0 0 40px --md-primary at 20%
```
Rationale: The Jam code is the social handshake of the entire game. A subtle glow differentiates it from a standard card and signals its importance.

### Label text ("Your Jam code")

| Property | Value |
|----------|-------|
| Font | `label` (Inter, 500, 0.875rem) |
| Color | `--md-on-primary-container` at 70% opacity |
| Letter spacing | `0.08em` |
| Text transform | `uppercase` |

### Code text (the six characters)

| Property | Value |
|----------|-------|
| Font family | Inter |
| Font weight | 800 |
| Font size | `5rem` (80px) |
| Line height | `1` |
| Letter spacing | `0.25em` |
| Color | `--color-jam-code-text` (`--md-on-primary-container`) |
| Text rendering | `optimizeLegibility` |

### Hint text ("Share this code…")

| Property | Value |
|----------|-------|
| Font | `caption` (Inter, 400, 0.75rem) |
| Color | `--md-on-primary-container` at 60% opacity |
| Max-width | `280px` |
| Text align | `center` |

### Entrance animation

When the Jam code display first appears (after a successful create or join), it must animate in using:
- Initial state: `opacity: 0; transform: scale(0.9)`
- Final state: `opacity: 1; transform: scale(1)`
- Duration: `250ms`
- Easing: `ease-decelerate` (`cubic-bezier(0, 0, 0, 1)`)

This animation is mandatory per `docs/design/look-and-feel.md` — Motion & Animation.

