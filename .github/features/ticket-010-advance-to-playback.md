# TICKET-010: Advance from Submission to Playback Phase

## User Story

As a Host,
I want to advance the Jam from the Submission phase into the Playback phase,
So that the submitted songs are played anonymously and all Players can start guessing.

---

## Acceptance Criteria

- **Given** the Jam is in the Submission phase and the caller is the Host,
  **When** the Host invokes `AdvancePhase`,
  **Then** the server creates one Round per Player Submission in a randomised order, transitions the Jam to the Playback phase, broadcasts `PhaseChanged { newPhase: "Playback" }` to all Players, and immediately broadcasts `RoundStarted { roundIndex: 0, youtubeUrl: <first anonymous URL> }` to all Players.

- **Given** the Jam is in the Submission phase but no Player has submitted a song,
  **When** the Host invokes `AdvancePhase`,
  **Then** the server sends `Error { code: "INVALID_PHASE" }` to the caller only; no transition occurs.

- **Given** the Jam is in the Submission phase and the caller is not the Host,
  **When** a non-Host Player invokes `AdvancePhase`,
  **Then** the server sends `Error { code: "UNAUTHORIZED" }` to the caller only; no transition occurs.

- **Given** the Jam is not in the Submission phase,
  **When** `AdvancePhase` is invoked,
  **Then** the server sends `Error { code: "INVALID_PHASE" }` to the caller only; no transition occurs. (The within-Playback advance is handled in TICKET-012.)

- **Given** the Jam has advanced to the Playback phase,
  **When** a Player views the Playback screen,
  **Then** the anonymous YouTube URL of the first Round is displayed as a link with no attribution; the current player list is visible; no guessing controls are shown (those are introduced in TICKET-011).

---

## Technical Notes

### Architecture placement

Follows the layer responsibilities defined in `docs/solution-architecture.md#layer-responsibilities` and the SignalR hub contract in `docs/realtime-communication.md`. Error codes `UNAUTHORIZED` and `INVALID_PHASE` are specified in `docs/realtime-communication.md#error-code-reference`.

### Files to create or modify

#### Domain — `YtGuessWho.Domain`

| Action | File | Notes |
|--------|------|-------|
| Create | `src/YtGuessWho.Domain/Entities/Round.cs` | Pure data class. Properties: `RoundIndex (int)`, `SubmitterPlayerId (string)`, `AnonymousSubmission (YoutubeUrl)`, `IsComplete (bool)` with `internal set` (set to `true` by `JamExtensions.SubmitGuess` in TICKET-011; read by `JamExtensions.AdvancePhase` in TICKET-012), `Guesses (IReadOnlyDictionary<string, string>)` (guessingPlayerId → guessedPlayerId) backed by an `internal`-accessible `Dictionary<string, string>` (mutated by `JamExtensions.SubmitGuess` in TICKET-011). No business logic. Constructor initialises `IsComplete = false` and an empty Guesses dictionary. |
| Modify | `src/YtGuessWho.Domain/Aggregates/Jam.cs` | Add `Rounds (IReadOnlyList<Round>)` backed by a private `List<Round>`. Add `InternalRounds (IList<Round>)` — `internal` accessor for `JamExtensions`. Add `CurrentRoundIndex (int)` with `internal set`, initialised to `-1`. |
| Create | `src/YtGuessWho.Domain/ValueObjects/JamAdvanceResult.cs` | Immutable record returned by the modified `JamExtensions.AdvancePhase`. Full shape defined now so that TICKET-012 requires no type change. Fields: `NewPhase (JamPhase)`, `PhaseHasChanged (bool)`, `StartedRoundIndex (int?)`, `StartedRoundUrl (string?)`, `IsGameOver (bool)`. In this ticket's paths `PhaseHasChanged` is always `true` and `IsGameOver` is always `false`. `StartedRoundIndex` and `StartedRoundUrl` are non-null when a Round begins. |
| Modify | `src/YtGuessWho.Domain/Extensions/JamExtensions.cs` | Change `AdvancePhase` return type from `void` to `JamAdvanceResult`. The existing **Lobby → Submission** path must return a `JamAdvanceResult` (`PhaseHasChanged: true`, `StartedRound*: null`, `IsGameOver: false`). Add the **Submission → Playback** path: guard that at least one Player has a non-null `Submission` (throw `InvalidPhaseTransitionException` otherwise); shuffle Players' Submissions using the existing `_random` field into an ordered list of `Round` objects; populate `InternalRounds`; set `CurrentRoundIndex = 0`; set `Phase = Playback`; return the appropriate `JamAdvanceResult`. Any phase not yet handled throws `InvalidPhaseTransitionException` — the Playback cases will be extended in TICKET-012. |

#### Application — `YtGuessWho.Application`

| Action | File | Notes |
|--------|------|-------|
| Create | `src/YtGuessWho.Application/DTOs/RoundStartedInfo.cs` | Immutable record: `RoundIndex (int)`, `YoutubeUrl (string)`. |
| Modify | `src/YtGuessWho.Application/DTOs/AdvancePhaseResult.cs` | Extend from `record (string JamCode, string NewPhase)` to also carry `bool PhaseHasChanged`, `RoundStartedInfo? StartedRound`, and `bool IsGameOver`. Full shape defined now; `IsGameOver` is always `false` in this ticket. |
| Modify | `src/YtGuessWho.Application/Services/Implementations/JamService.cs` | Update `AdvancePhase` to consume the `JamAdvanceResult` returned by the domain extension: map `PhaseHasChanged`, `IsGameOver`, and `StartedRound` into the updated `AdvancePhaseResult`. |

#### Infrastructure — `YtGuessWho.Infrastructure`

| Action | File | Notes |
|--------|------|-------|
| Modify | `src/YtGuessWho.Infrastructure/Hubs/GameHub.cs` | Extend `AdvancePhase()`: after broadcasting `PhaseChanged` (unconditional for now — `PhaseHasChanged` is always `true` in this ticket), also broadcast `RoundStarted(new RoundStartedPayload(result.StartedRound.RoundIndex, result.StartedRound.YoutubeUrl))` when `result.StartedRound is not null`. The `PhaseHasChanged` condition and `GameEnded` broadcast are added in TICKET-012. |

#### Tests — `YtGuessWho.Tests`

| Action | File | Notes |
|--------|------|-------|
| Modify | `tests/YtGuessWho.Tests/Domain/JamTests.cs` | Update existing Lobby → Submission `AdvancePhase` tests to handle the new `JamAdvanceResult` return type (assert `PhaseHasChanged = true`, null `StartedRound*`, `IsGameOver = false`). Add tests for: Submission → Playback creates one `Round` per Player Submission; all Players' Submissions appear as `SubmitterPlayerId` across the Rounds; `CurrentRoundIndex` is set to 0; `InvalidPhaseTransitionException` when no Player has a Submission; `InvalidPhaseTransitionException` when not in Submission phase. |
| Modify | `tests/YtGuessWho.Tests/Application/JamServiceAdvancePhaseTests.cs` | Update existing Lobby → Submission assertions to match the new `AdvancePhaseResult` shape. Add tests for: Submission → Playback returns `StartedRound` with `RoundIndex = 0` and a non-empty `YoutubeUrl`, `PhaseHasChanged = true`, `IsGameOver = false`; `InvalidPhaseTransitionException` propagates when no Submissions exist. |

#### Client — `client/`

| Action | File | Notes |
|--------|------|-------|
| Create | `client/src/app/core/models/round-started.model.ts` | TypeScript interface `RoundStartedEvent { roundIndex: number; youtubeUrl: string }`. |
| Modify | `client/src/app/core/hub-connection.service.ts` | Add `onRoundStarted(handler: (payload: RoundStartedEvent) => void): void` — thin delegation to `this.#connection.on('RoundStarted', handler)`. |
| Modify | `client/src/app/core/hub-connection.service.spec.ts` | Add test for `onRoundStarted`: registers the correct event name and forwards the handler. |
| Create | `client/src/app/playback/playback.component.ts` | New standalone `ChangeDetectionStrategy.OnPush` component. **Inputs:** `jamCode (string)`, `players (ReadonlyArray<Player>)`, `myPlayerId (string \| null)`, `isHost (boolean)`. **Output:** `left (void)`. **Signals:** `currentRoundIndex (signal<number>(-1))`, `currentYoutubeUrl (signal<string \| null>(null))`, `isLeaving (signal<boolean>(false))`, `errorMessage (signal<string \| undefined>(undefined))`. In the constructor, register `onRoundStarted` (unregister on destroy via `DestroyRef`): set `currentRoundIndex` and `currentYoutubeUrl` from the payload. **Template:** jam code hero; the YouTube URL as a plain `<a>` link when non-null (no iframe — client-side only per `docs/context.md`); the player list (names only, no Guess controls — those arrive in TICKET-011); a "Waiting for guesses…" status message; Leave Jam button (disabled while `isLeaving()`). **Method:** `onLeaveJam()` — `isLeaving(true)`, call `hubService.leaveJam()`, on resolve emit `left`, on reject set `errorMessage`, finally `isLeaving(false)`. |
| Create | `client/src/app/playback/playback.component.spec.ts` | Cover: `onRoundStarted` sets `currentYoutubeUrl` and `currentRoundIndex`; URL link renders with correct `href`; player list shows all player names; Leave Jam calls `hubService.leaveJam` and emits `left` on success; error shown when `leaveJam` rejects. |
| Create | `client/src/app/playback/playback.component.scss` | Minimal styles following `docs/design/component-style-guide.md`. |
| Modify | `client/src/app/lobby/lobby.component.ts` | Import `PlaybackComponent`. Add `@else if (currentPhase() === 'Playback' \|\| currentPhase() === 'Results')` branch rendering `<app-playback [jamCode]="jamCode()!" [players]="players()" [myPlayerId]="myPlayerId()" [isHost]="isHost()" (left)="onLeft()" />`. |
| Modify | `client/src/app/lobby/lobby.component.spec.ts` | Add tests: `PlaybackComponent` renders when `currentPhase` is `'Playback'`; renders when `currentPhase` is `'Results'`; `SubmissionComponent` not rendered when `currentPhase` is `'Playback'`. |

### NuGet packages

None.

### Key design constraints

**`AdvancePhaseResult` and `JamExtensions.AdvancePhase` are breaking changes.** The existing `JamService.AdvancePhase` return expression, the Hub's `AdvancePhase()` broadcast, and all existing `JamServiceAdvancePhaseTests.cs` assertions must be updated to match the new shapes. All existing domain `AdvancePhase` tests must also be updated.

**Full `JamAdvanceResult` shape defined upfront.** `PhaseHasChanged` and `IsGameOver` are always `true` and `false` respectively in this ticket's paths. They are consumed in TICKET-012 without any type change.

**Round shuffle uses the existing `_random` field** in `JamExtensions`. Do not introduce a second `Random` instance.

**`Round.SubmitterPlayerId` is server-side only.** It is never included in any event payload. `RoundStarted` carries only `roundIndex` and `youtubeUrl` per `docs/realtime-communication.md`. The submitter's identity is first revealed in `RoundEnded` (TICKET-011).

**`Round.IsComplete` and the internal Guesses dictionary are defined here but only written in TICKET-011.** Both are declared with `internal set` / `internal` visibility so `JamExtensions.SubmitGuess` can reach them without changing the class in a later ticket.

**`PlaybackComponent` has no Guess controls in this ticket.** It shows a "Waiting for guesses…" placeholder. Guess buttons, `GuessSubmitted`, and `RoundEnded` handling are added in TICKET-011.

### Out of scope

- Submitting a Guess (`SubmitGuess` hub method) — TICKET-011.
- Round completion detection and `RoundEnded` broadcast — TICKET-011.
- Advancing within Playback (next Round) and game end — TICKET-012.
- Scoring — a future ticket.
- YouTube iframe embedding — handled client-side (see `docs/context.md`).

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
- Fresh server start (no active Jams).

---

### Scenario 1 — Host Advances from Submission to Playback

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | **Tab A**: create a Jam as Alice; **Tab B**: join as Bob | Both tabs in Lobby |
| 2 | **Tab A**: advance to Submission phase | Both tabs in Submission view |
| 3 | **Tab A**: submit `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | Alice marked as submitted |
| 4 | **Tab B**: submit `https://youtu.be/oHg5SJYRHA0` | Both marked as submitted; "All songs are in!" shown |
| 5 | **Tab A**: click the advance button | Both tabs transition to the Playback view |
| 6 | Observe both tabs | A YouTube URL link is shown with no player attribution; player list visible; no Guess controls; "Waiting for guesses…" message shown |
| 7 | Inspect server logs | `Information` entries: phase advanced to Playback; Round 0 started |

---

### Scenario 2 — Non-Host Cannot Advance to Playback

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Both tabs in Submission phase; all songs submitted | "All songs are in!" shown |
| 2 | **Tab B** DevTools Console: invoke `AdvancePhase` via the SignalR connection | Error message on **Tab B**: `UNAUTHORIZED`; both tabs remain in Submission view |
| 3 | Inspect server logs | `Warning` entry: `UNAUTHORIZED` |

---

### Scenario 3 — URL Is Anonymous (No Attribution Shown)

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Both tabs in Playback view, Round 0 active | A YouTube URL link is visible |
| 2 | Observe both tabs | No player name appears next to or near the URL; attribution is completely absent |
| 3 | Inspect server logs | `RoundStarted` entry contains the URL and `RoundIndex: 0`; the `SubmitterPlayerId` does not appear in any client-visible event |

