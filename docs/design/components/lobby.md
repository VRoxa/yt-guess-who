# Component Vision Spec — `app-lobby`

> **Component:** `app-lobby` · `client/src/app/lobby/lobby.component.ts`
> **Last updated:** June 2026 — rewritten as vision spec (initial version was over-specified).
> User flow reference: `docs/design/user-flow.md`

---

## 1. Purpose

`app-lobby` is the entry point for every user — both the player who will join an existing Jam and the host who will create one. It covers two distinct moments: choosing how to enter a Jam, and waiting inside the Jam for others to arrive. It maps to the `LOBBY` through `JAM_CONFIRMED` nodes in the user flow, and will eventually encompass the `WAITING_ROOM` node as that feature is built out.

---

## 2. User Journey

### Getting into a Jam

The user arrives at a clean, uncluttered screen. The first and only thing asked of them is their name — nothing else is visible yet. This keeps the initial impression simple and focused.

Once they type a name, the screen naturally reveals the next question: do you want to create a Jam or join one? These two options appear smoothly — not by a page change, not by a button click to proceed, but as an organic continuation of the form as the name field fills. The feeling should be that the page is responding to them, not waiting for them to find a "Next" button.

If they choose to **create a Jam**, they click one button and they're in. No further input needed.

If they choose to **join a Jam**, a code input appears in place of the two choice buttons, along with a "Join" CTA and a "Back" option in case they change their mind. The code field should receive focus automatically so they can start typing immediately.

While either action is in flight, the relevant button communicates the pending state through its label ("Creating…" / "Joining…"), and nothing can be double-submitted.

If something goes wrong, the error appears inline below the form — no overlay, no modal. The user stays where they are and can retry.

### Inside the Jam

Once in, the screen transforms entirely. The Jam code becomes the undisputed centrepiece — large, prominent, impossible to miss. This is the piece of information the user needs to share with friends, so it must feel like the page was designed around it.

Directly beneath the code, a **"Copy Jam code"** button lets the user share it without selecting the text manually. After clicking, the button briefly confirms the copy with a visual change before resetting.

Below that, the player list fills in as people join. Each new name appears with a subtle animation — the list quietly grows. The host is visually distinguished from regular players.

At the bottom of the player list, a short waiting message — "Waiting for other players to join…" — with animated dots signals that the system is live and listening. The dots pulse gently, reinforcing that something is actively happening without being distracting.

---

## 3. Key UI Concepts

- **Progressive disclosure for the pre-join flow.** The form reveals itself in steps — name first, then action choice, then code input if joining. Each step only appears when the previous one is satisfied. This avoids overwhelming the user with the full form at once and makes the flow feel guided rather than bureaucratic.

- **The Jam code is the hero.** Once inside a Jam, the code dominates the screen. It should be the largest, most prominent element — everything else is secondary. If a user glances at the screen for one second, the code is what they remember. This is consistent with Design Principle 5 in `docs/design/look-and-feel.md`.

- **Copy convenience.** Users should never have to triple-click to select a code and copy it. A dedicated copy button removes that friction entirely. The button's feedback state ("Copied!") reassures the user without requiring them to verify in a separate clipboard app.

- **Live player list.** The list grows in real time as players join. There is no refresh, no reload — each new name simply appears. The host entry is visually distinguished so any player can instantly tell who is running the session.

- **Animated waiting indicator.** The pulsing dots next to the waiting message serve a functional purpose: they tell the user the connection is live and the server is listening. Without them, a static "Waiting…" message feels like a stale UI. The animation should be subtle — a gentle rhythm, not a distraction. Note: this is an intentional exception to the no-looping-animation rule in `docs/design/look-and-feel.md §5`, justified because the dots communicate active server state, not decoration.

---

## 4. Out of Scope

- **Start Game button** — will be added when the host game-start feature is implemented.
- **"Waiting for host to start…" status for non-host players** — Host vs Player view distinction is a future concern.
- **PlayerLeft handling** — removing a player from the list on disconnect is deferred.
- **Reconnection after a dropped WebSocket** — undefined behaviour in V1.
- **Reduced motion support** — `prefers-reduced-motion` is deferred.
- **Any game phase beyond the lobby** — submission, playback, and results are separate components.
