# TICKET-012: Advance Rounds and End Game

## User Story

As a Host,
I want to advance to the next song after all eligible Players have guessed,
So that the game continues until every submitted song has been played and revealed.

---

## Acceptance Criteria

### Advancing to the next Round

- **Given** the Jam is in the Playback phase, the current Round is complete, there are remaining Rounds, and the caller is the Host,
  **When** the Host invokes `AdvancePhase`,
  **Then** the server advances `CurrentRoundIndex` by one and broadcasts `RoundStarted { roundIndex: <next>, youtubeUrl: <next anonymous URL> }` to all Players. No `PhaseChanged` event is sent.

- **Given** the Jam is in the Playback phase and the current Round is **not** complete,
  **When** any Player invokes `AdvancePhase`,
  **Then** the server sends `Error { code: "INVALID_PHASE" }` to the caller only; `CurrentRoundIndex` does not change.

- **Given** the Jam is in the Playback phase and the caller is not the Host,
  **When** a non-Host Player invokes `AdvancePhase`,
  **Then** the server sends `Error { code: "UNAUTHORIZED" }` to the caller only.

### Ending the game

- **Given** the Jam is in the Playback phase, the current Round is complete, there are no remaining Rounds, and the caller is the Host,
  **When** the Host invokes `AdvancePhase`,
  **Then** the server transitions the Jam to the Results phase, broadcasts `PhaseChanged { newPhase: "Results" }` to all Players, and immediately broadcasts `GameEnded` to all Players.

---

## Technical Notes

### Architecture placement

Follows the layer responsibilities defined in `docs/solution-architecture.md#layer-responsibilities`. Error codes `UNAUTHORIZED` and `INVALID_PHASE` are specified in `docs/realtime-communication.md#error-code-reference`.

### Prerequisites

- Builds on `JamAdvanceResult` and the Playback-phase Jam structure introduced in **TICKET-010**.
- Requires `Round.IsComplete` to be set to `true` by `JamExtensions.SubmitGuess` as implemented in **TICKET-011**.

### Files to create or modify

#### Domain — `YtGuessWho.Domain`

| Action | File | Notes |
|--------|------|-------|
| Modify | `src/YtGuessWho.Domain/Extensions/JamExtensions.cs` | Extend `AdvancePhase` with the Playback cases (which currently throw `InvalidPhaseTransitionException` as a catch-all): **Playback with an incomplete current Round** — throw `InvalidPhaseTransitionException`; **Playback with a complete current Round and remaining Rounds** — increment `CurrentRoundIndex`, return `JamAdvanceResult { NewPhase: Playback, PhaseHasChanged: false, StartedRoundIndex: <new index>, StartedRoundUrl: <URL as string>, IsGameOver: false }`; **Playback with a complete current Round and no remaining Rounds** — set `Phase = Results`, return `JamAdvanceResult { NewPhase: Results, PhaseHasChanged: true, StartedRoundIndex: null, StartedRoundUrl: null, IsGameOver: true }`. Round completion is checked via `jam.Rounds[jam.CurrentRoundIndex].IsComplete`. All other guards (`UNAUTHORIZED`, null arguments) remain unchanged. |

#### Application — `YtGuessWho.Application`

| Action | File | Notes |
|--------|------|-------|
| Modify | `src/YtGuessWho.Application/Services/Implementations/JamService.cs` | Update `AdvancePhase` logging: when `domainResult.IsGameOver` is `true`, log a distinct `Information` message indicating the game has ended. No structural change to the return mapping — `AdvancePhaseResult` already carries `IsGameOver`, `PhaseHasChanged`, and `StartedRound` from TICKET-010. |

#### Infrastructure — `YtGuessWho.Infrastructure`

| Action | File | Notes |
|--------|------|-------|
| Modify | `src/YtGuessWho.Infrastructure/Hubs/GameHub.cs` | Update `AdvancePhase()`: wrap the existing `PhaseChanged` broadcast in `if (result.PhaseHasChanged)` (currently it is unconditional — this change is safe because all pre-TICKET-012 paths had `PhaseHasChanged = true`); add `if (result.IsGameOver) await Clients.Group(result.JamCode).GameEnded(new GameEndedPayload([]))` after the phase-change block. The `RoundStarted` broadcast (`if (result.StartedRound is not null)`) is already present from TICKET-010 and handles the next-round case without further changes. |

#### Tests — `YtGuessWho.Tests`

| Action | File | Notes |
|--------|------|-------|
| Modify | `tests/YtGuessWho.Tests/Domain/JamTests.cs` | Add tests for the new Playback paths: within-Playback advance on a complete Round with more Rounds returns `PhaseHasChanged = false` and `StartedRoundIndex` increments by 1; within-Playback advance on a complete final Round returns `IsGameOver = true` and `PhaseHasChanged = true`; `InvalidPhaseTransitionException` when advancing Playback with an incomplete current Round. |
| Modify | `tests/YtGuessWho.Tests/Application/JamServiceAdvancePhaseTests.cs` | Add tests for: within-Playback advance returns `PhaseHasChanged = false` and a populated `StartedRound`; final-Round advance returns `IsGameOver = true` and `PhaseHasChanged = true`; `InvalidPhaseTransitionException` propagates when the current Round is incomplete. |

#### Client — `client/`

| Action | File | Notes |
|--------|------|-------|
| Create | `client/src/app/core/models/game-ended.model.ts` | TypeScript interface `GameEndedEvent {}` — a marker interface with no fields. The event itself signals the game is over; leaderboard data is deferred to a future ticket. |
| Modify | `client/src/app/core/hub-connection.service.ts` | Add `onGameEnded(handler: (payload: GameEndedEvent) => void): void` — thin delegation to `this.#connection.on('GameEnded', handler)`. |
| Modify | `client/src/app/core/hub-connection.service.spec.ts` | Add test for `onGameEnded`: registers the correct event name and forwards the handler. |
| Modify | `client/src/app/playback/playback.component.ts` | Add signals: `isAdvancingRound (signal<boolean>(false))`, `gameOver (signal<boolean>(false))`. In constructor, register `onGameEnded` (unregister on destroy): set `gameOver(true)`. Update template: when `isHost()` and `roundResult()` is non-null and `gameOver()` is `false`, show a "Next Round" button disabled while `isAdvancingRound()`; when `gameOver()` is `true`, show a "Game over!" message and hide the "Next Round" button. Add `onAdvanceRound()`: `isAdvancingRound(true)`, call `hubService.advancePhase()`, on reject set `errorMessage`, finally `isAdvancingRound(false)`. |
| Modify | `client/src/app/playback/playback.component.spec.ts` | Add tests: "Next Round" button visible to Host when `roundResult` is set and `gameOver` is `false`; not visible to non-Host; not visible when `gameOver` is `true`; clicking "Next Round" calls `hubService.advancePhase`; `onGameEnded` sets `gameOver` to `true` and shows "Game over!" message; error shown when `advancePhase` rejects. |

### NuGet packages

None.

### Key design constraints

**`PhaseHasChanged` condition added to the Hub.** The Hub currently always broadcasts `PhaseChanged`. Wrapping it in `if (result.PhaseHasChanged)` is safe because all paths implemented before this ticket returned `PhaseHasChanged = true`.

**`Round.IsComplete` is the completion signal.** `JamExtensions.AdvancePhase` checks `jam.Rounds[jam.CurrentRoundIndex].IsComplete`. This flag is set by `JamExtensions.SubmitGuess` (TICKET-011). No recomputation is needed.

**`Results` phase is terminal.** Once the Jam reaches Results, further `AdvancePhase` calls still hit the catch-all `InvalidPhaseTransitionException` — the existing behaviour is unchanged.

**`GameEndedPayload` is passed an empty list.** The existing `GameEndedPayload` record requires `IReadOnlyList<PlayerFinalScore>`. Pass an empty list — scores are deferred to a future ticket.

### Out of scope

- Scoring and the final leaderboard — a future ticket.
- A dedicated `ResultsComponent` — the "Game over!" message in `PlaybackComponent` covers the Results state for now.
- Player disconnection handling mid-Round (deferred).
- A `SkipRound` mechanism for the Host.

---

## Test Plan

> **For the human tester only.**
> Manual verification steps to execute after the Dev has finished with both services running.

### Tooling

- Server running via `dotnet run` from `server/src/YtGuessWho.Api/` (default port `5030`).
- Angular dev server running via `pnpm start` from `client/` (`http://localhost:4200`).
- Two browser tabs: **Tab A** (Alice / Host), **Tab B** (Bob).
- Server terminal visible for log inspection.

### Preconditions

- Both services running with no startup errors.
- Fresh server start.
- Reach a completed Round: Alice creates Jam → Bob joins → advance to Submission → both submit valid URLs → advance to Playback → all eligible Players submit Guesses → `RoundEnded` reveal shown on both tabs.

---

### Scenario 1 — Host Cannot Advance Mid-Round

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Both tabs in Playback view; Bob has not yet guessed | Round is incomplete; no reveal panel shown |
| 2 | **Tab A** DevTools Console: invoke `AdvancePhase` directly | Error on **Tab A**: `INVALID_PHASE`; current Round unchanged on both tabs |
| 3 | Inspect server logs | `Warning` entry: `INVALID_PHASE` |

---

### Scenario 2 — Host Advances to the Next Round

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Round 0 ended; reveal panel shown on both tabs | "Next Round" button visible on **Tab A** (Host); not visible on **Tab B** |
| 2 | **Tab A**: click "Next Round" | Both tabs: reveal panel disappears; new YouTube URL link shown; "0 of N have guessed" indicator resets; Guess buttons re-enabled |
| 3 | Inspect server logs | `Information` entry: Round 1 started; no `PhaseChanged` log entry |

---

### Scenario 3 — Non-Host Cannot Advance Round

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Round 0 ended; reveal panel shown | "Next Round" button not visible on **Tab B** |
| 2 | **Tab B** DevTools Console: invoke `AdvancePhase` directly | Error on **Tab B**: `UNAUTHORIZED`; no round change on either tab |
| 3 | Inspect server logs | `Warning` entry: `UNAUTHORIZED` |

---

### Scenario 4 — Game Ends After the Final Round

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Final Round's reveal panel shown on both tabs | "Next Round" button visible on **Tab A** |
| 2 | **Tab A**: click "Next Round" | Both tabs receive `PhaseChanged { newPhase: "Results" }` and `GameEnded`; "Game over!" message shown; "Next Round" button hidden |
| 3 | Inspect server logs | `Information` entries: phase advanced to Results; GameEnded broadcast |

