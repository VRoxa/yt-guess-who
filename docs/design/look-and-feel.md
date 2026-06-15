# Look & Feel

> This document is the authoritative source for the visual identity and aesthetic direction of YtGuessWho.
> All implementation styling decisions must be consistent with the principles, values, and systems defined here.

---

## 1. Design Philosophy

Five non-negotiable principles govern every visual decision in this application.

| # | Principle | What it means in practice |
|---|-----------|---------------------------|
| 1 | **Clarity under pressure** | Players are making real-time decisions during a game. Every interactive element must be instantly recognisable without reading. Labels, button states, and status indicators must never require interpretation. |
| 2 | **Excitement without noise** | The UI must feel energetic and social, but decorative elements must never compete with functional ones. Visual interest is achieved through colour, typography, and spacing — not through excessive animation or pattern. |
| 3 | **Dark-first** | The application uses a dark colour scheme as its baseline. Bright accents on dark surfaces create the visual impact that a music game demands, while reducing eye strain during longer sessions. Light mode is not in scope for V1. |
| 4 | **Every state must be visible** | Connection status, loading states, error conditions, and disabled controls must always communicate their state to the user through colour and/or iconography. Invisible state changes are not permitted. |
| 5 | **The Jam code is the hero** | The six-character Jam code is the single most important piece of information the application can show. When it is on screen, it must dominate the visual hierarchy without competition. |

---

## 2. Aesthetic Direction

**Mood:** Electric · Social · Late-night · Focused

**References (tone only — not visual copy):**
- Spotify's dark player — the discipline of showing only what matters, on a near-black surface with one dominant accent colour.
- A concert venue scoreboard — large, readable type designed to be seen across a room.
- YouTube's dark mode — familiarity for the target audience; the brand they associate with the content.

**What the UI must feel like to a new Player:**
> "This looks like a real game. I trust it. I'm excited to play."

**What the UI must never feel like:**
> Corporate, clinical, or like a form I have to fill in.

---

## 3. Spacing & Layout System

### Base unit
The single spacing unit is **4px** (`0.25rem` at a 16px root font size). Every spacing value in the application is a multiple of this unit.

### Spacing scale

| Token name | Multiplier | px value | rem value | Typical use |
|------------|-----------|----------|-----------|-------------|
| `space-1` | ×1 | 4px | 0.25rem | Icon internal padding, tight badge padding |
| `space-2` | ×2 | 8px | 0.5rem | Between a label and its input, inline icon gap |
| `space-3` | ×3 | 12px | 0.75rem | Internal button padding (vertical), chip padding |
| `space-4` | ×4 | 16px | 1rem | Standard section padding, input internal padding |
| `space-6` | ×6 | 24px | 1.5rem | Between form fields, card internal padding |
| `space-8` | ×8 | 32px | 2rem | Between major sections within a screen |
| `space-12` | ×12 | 48px | 3rem | Jam code container internal padding |
| `space-16` | ×16 | 64px | 4rem | Top-of-screen breathing room, page-level margins |

### Content width constraints

| Screen type | Max content width | Justification |
|-------------|-------------------|---------------|
| Form screens (Lobby) | `560px` | Keeps inputs at a comfortable reading width; prevents stretched fields on wide viewports |
| Game screens (future) | `900px` | Accommodates YouTube embed alongside player list |
| Full-bleed surfaces | `100%` | Background colours and page wrappers only |

The content container is always **horizontally centred** using `margin-inline: auto` and `padding-inline: 1rem` for small viewports.

### Layout model
- **Primary layout primitive:** CSS Flexbox, column direction for stacked forms, row direction for button groups and inline elements.
- **Page-level layout:** Single column. No multi-column grid until the game screen introduces it.
- **Vertical rhythm:** All stacked elements use the spacing scale. No arbitrary `margin-top` or `margin-bottom` values outside the scale.

---

## 4. Elevation & Depth

Elevation communicates the layering of interactive surfaces. The application uses four elevation levels. Values follow the Material Design 3 surface tint + shadow model on dark surfaces.

| Level | Name | Box-shadow value | Surface colour treatment | Typical elements |
|-------|------|-----------------|--------------------------|-----------------|
| 0 | Flat | `none` | Base `--md-surface` | Page background, non-interactive regions |
| 1 | Raised | `0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.6)` | `--md-surface` + 5% primary tint | Cards, input fields, dropdowns |
| 2 | Floating | `0 4px 8px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.4)` | `--md-surface` + 8% primary tint | Modals, drawers, the Jam code display |
| 3 | Overlay | `0 8px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.5)` | `--md-surface` + 11% primary tint | Toasts, tooltips, popovers |

**Rule:** Never apply elevation to an element that is not interactive or does not need to establish visual hierarchy over another element.

---

## 5. Motion & Animation

### Standard timing tokens

| Token | Value | Use |
|-------|-------|-----|
| `duration-instant` | `80ms` | State changes the user triggered (button press feedback) |
| `duration-fast` | `150ms` | Appearing/disappearing small elements (error messages, chips) |
| `duration-standard` | `250ms` | Screen transitions, card appearance, expanding elements |
| `duration-slow` | `400ms` | Complex multi-property transitions (reserved, use sparingly) |

### Standard easing tokens

| Token | CSS value | Use |
|-------|-----------|-----|
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Elements entering and expanding |
| `ease-decelerate` | `cubic-bezier(0, 0, 0, 1)` | Elements sliding in (entering from off-screen) |
| `ease-accelerate` | `cubic-bezier(0.3, 0, 1, 1)` | Elements exiting or collapsing |

### Animation rules

| Situation | Rule |
|-----------|------|
| Button hover | **Mandatory** — `80ms` background colour transition using `ease-standard` |
| Form field focus | **Mandatory** — `150ms` border-colour and box-shadow transition using `ease-standard` |
| Error message appearing | **Mandatory** — fade in over `150ms` using `ease-standard` |
| Jam code appearing after create/join | **Mandatory** — fade + scale-up (from `scale(0.9)` to `scale(1)`) over `250ms` using `ease-decelerate` |
| Page-level state transitions | **Optional** — cross-fade at `250ms` if implementation cost is low; static swap otherwise |
| Looping or idle animations | **Forbidden** — there must be no animations running when the user is not actively interacting |
| Animation on disabled elements | **Forbidden** — disabled controls must be visually static |

---

## 6. Iconography

### Library
Use **Material Symbols** (the variable font variant, `Outlined` style) loaded via Google Fonts. This is the native icon set for Material Design 3 and provides consistent optical sizing and weight.

```
https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined
```

### Sizing conventions

| Context | Icon size | Optical size setting |
|---------|-----------|---------------------|
| Inline with body text | `1.25rem` (20px) | `opsz: 20` |
| Standalone button icon | `1.5rem` (24px) | `opsz: 24` |
| Large feature icon (empty states) | `3rem` (48px) | `opsz: 48` |

### Usage rule
An icon may **replace** a text label only when:
- The icon is universally understood (e.g., a close ×, a checkmark).
- A tooltip or accessible `aria-label` is provided.

An icon may **accompany** a text label when it reinforces the action at a glance (e.g., a music note next to "Submit Song"). In all other cases, use text only.

