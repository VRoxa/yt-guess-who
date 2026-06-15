# Color Palette

> This document is the authoritative source for all color decisions in YtGuessWho.
> All color values must be applied as CSS custom properties defined in `src/styles.scss`.
> No hardcoded color values are permitted anywhere else in the codebase.

---

## 1. Source Color & Theme

**Source color:** `#7C3AED` — a vivid violet-purple.

This hue was chosen because it:
- Evokes creativity, music, and nightlife without referencing any specific platform.
- Provides strong contrast opportunities on dark surfaces.
- Distinguishes the application visually from YouTube's red and Spotify's green.

**Scheme:** Dark only (V1). A light scheme is out of scope.

**Derivation method:** Material Design 3 tonal palette generation from the source color, manually tuned for the dark scheme to ensure WCAG AA compliance (minimum 4.5:1 contrast ratio for normal text, 3:1 for large text and UI components).

---

## 2. Color Role Definitions

All values below are for the **dark scheme**. The CSS custom property names must be declared exactly as shown.

### Primary

| CSS custom property | Hex value | Contrast against pair | Intended use |
|--------------------|-----------|-----------------------|--------------|
| `--md-primary` | `#D0BCFF` | 9.3:1 on `--md-background` | Primary action button background, active focus indicators, key highlights |
| `--md-on-primary` | `#381E72` | 9.3:1 on `--md-primary` | Text and icons placed directly on a primary-colored surface |
| `--md-primary-container` | `#4F378B` | — | Elevated surfaces that carry primary brand identity (e.g., Jam code display background) |
| `--md-on-primary-container` | `#EADDFF` | 9.1:1 on `--md-primary-container` | Text and icons inside a primary container |

### Secondary

| CSS custom property | Hex value | Contrast against pair | Intended use |
|--------------------|-----------|-----------------------|--------------|
| `--md-secondary` | `#CCC2DC` | 8.1:1 on `--md-background` | Secondary action elements, supporting highlights |
| `--md-on-secondary` | `#332D41` | 8.1:1 on `--md-secondary` | Text on secondary-colored surfaces |
| `--md-secondary-container` | `#4A4458` | — | Subtle container surfaces that need visual distinction without primary emphasis |
| `--md-on-secondary-container` | `#E8DEF8` | 8.6:1 on `--md-secondary-container` | Text inside secondary containers |

### Error

| CSS custom property | Hex value | Contrast against pair | Intended use |
|--------------------|-----------|-----------------------|--------------|
| `--md-error` | `#FFB4AB` | 7.8:1 on `--md-background` | Error text, error border on inputs, destructive action indicators |
| `--md-on-error` | `#690005` | 7.8:1 on `--md-error` | Text on an error-colored background |
| `--md-error-container` | `#93000A` | — | Background of error message containers and inline error banners |
| `--md-on-error-container` | `#FFDAD6` | 9.2:1 on `--md-error-container` | Text inside error containers |

### Surface

| CSS custom property | Hex value | Contrast against pair | Intended use |
|--------------------|-----------|-----------------------|--------------|
| `--md-surface` | `#1C1B1F` | — | Default background of cards, inputs, and interactive containers |
| `--md-on-surface` | `#E6E1E5` | 12.6:1 on `--md-surface` | Primary body text and icons on surface backgrounds |
| `--md-surface-variant` | `#49454F` | — | Slightly elevated surfaces, input field backgrounds, outlined containers |
| `--md-on-surface-variant` | `#CAC4D0` | 5.1:1 on `--md-surface-variant` | Secondary text, placeholder text, helper text on variant surfaces |
| `--md-outline` | `#938F99` | 3.1:1 on `--md-surface` | Input borders, dividers, outline button borders. Meets 3:1 for non-text UI components. |

### Background

| CSS custom property | Hex value | Contrast against pair | Intended use |
|--------------------|-----------|-----------------------|--------------|
| `--md-background` | `#1C1B1F` | — | Page-level background (same as `--md-surface` in MD3 dark scheme) |
| `--md-on-background` | `#E6E1E5` | 12.6:1 on `--md-background` | Text rendered directly on the page background (not inside a card) |

> **Note on `--md-surface` and `--md-background`:** In Material Design 3's dark scheme, `surface` and `background` are intentionally the same base value. Elevation differentiation is achieved by the primary-tinted surface overlays described in `docs/design/look-and-feel.md` — Elevation & Depth.

---

## 3. Semantic Aliases

Semantic aliases provide intent-driven names for common use cases. The Dev uses the alias when the semantic meaning is clear; they use the role directly when building a new component type that has no alias yet.

| Alias | Maps to | When to use |
|-------|---------|-------------|
| `--color-action-primary` | `var(--md-primary)` | Background of the primary call-to-action button |
| `--color-action-primary-text` | `var(--md-on-primary)` | Text inside the primary button |
| `--color-action-secondary` | `transparent` (with `--md-outline` border) | Outlined / ghost button background |
| `--color-action-secondary-text` | `var(--md-primary)` | Text on outlined buttons |
| `--color-danger` | `var(--md-error)` | Error text, destructive action indicators |
| `--color-danger-surface` | `var(--md-error-container)` | Background of inline error messages |
| `--color-danger-text` | `var(--md-on-error-container)` | Text inside error message containers |
| `--color-input-bg` | `var(--md-surface-variant)` | Background of text input fields |
| `--color-input-border` | `var(--md-outline)` | Default border on input fields |
| `--color-input-border-focus` | `var(--md-primary)` | Border color when an input has focus |
| `--color-input-border-error` | `var(--md-error)` | Border color when an input is in error state |
| `--color-input-placeholder` | `var(--md-on-surface-variant)` | Placeholder text inside inputs |
| `--color-jam-code-text` | `var(--md-on-primary-container)` | The six-character Jam code text |
| `--color-jam-code-bg` | `var(--md-primary-container)` | Background container of the Jam code display |

---

## 4. Usage Rules

| UI element | Background color | Text / icon color | Border color |
|------------|-----------------|-------------------|--------------|
| Page background | `--md-background` | — | — |
| Section card | `--md-surface` (elevation 1) | `--md-on-surface` | none |
| Primary action button | `--color-action-primary` | `--color-action-primary-text` | none |
| Secondary / outline button | `transparent` | `--color-action-secondary-text` | `--color-input-border` |
| Disabled button (any variant) | `--md-surface-variant` at 38% opacity | `--md-on-surface` at 38% opacity | none |
| Text input (default) | `--color-input-bg` | `--md-on-surface` | `--color-input-border` (1.5px) |
| Text input (focused) | `--color-input-bg` | `--md-on-surface` | `--color-input-border-focus` (2px) |
| Text input (error) | `--color-input-bg` | `--md-on-surface` | `--color-input-border-error` (2px) |
| Text input (disabled) | `--md-surface` | `--md-on-surface` at 38% opacity | `--md-outline` at 38% opacity |
| Input placeholder text | — | `--color-input-placeholder` at 60% opacity | — |
| Label text (above input) | — | `--md-on-surface-variant` | — |
| Error message text | — | `--color-danger` | — |
| Error message container | `--color-danger-surface` | `--color-danger-text` | none |
| Body text on background | — | `--md-on-background` | — |
| Heading text | — | `--md-on-background` | — |
| Jam code display container | `--color-jam-code-bg` | — | `--md-primary` at 40% opacity (2px) |
| Jam code text | — | `--color-jam-code-text` | — |
| Hint / caption text | — | `--md-on-surface-variant` | — |

