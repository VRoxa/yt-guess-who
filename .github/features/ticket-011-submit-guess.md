# TICKET-011: Submit a Guess

## User Story

As a Player in the Playback phase,
I want to submit a Guess attributing the current song to one of my fellow Players,
So that my guess is recorded and the group can see the reveal when the Round ends.

---

## Acceptance Criteria

### Submitting a Guess

- **Given** the Jam is in the Playback phase and the calling Player is not the submitter of the active Round,
  **When** the Player invokes `SubmitGuess` with a valid `guessedPlayerId`,
  **Then** the server records the Guess and broadcasts `GuessSubmitted { playerId: <guessingPlayerId> }` to all Players in the Jam.

- **Given** the calling Player is the submitter of the active Round,
  **When** the Player invokes `SubmitGuess`,
  **Then** the server sends `Error { code: "CANNOT_GUESS_OWN_SUBMISSION" }` to the caller only; no Guess is recorded.

- **Given** a Player has already submitted a Guess for the current Round,
  **When** the same Player invokes `SubmitGuess` a second time,
  **Then** the server sends `Error { code: "ALREADY_GUESSED" }` to the caller only; no second Guess is recorded.

- **Given** the `guessedPlayerId` does not correspond to any Player in the Jam,
  **When** a Player invokes `SubmitGuess`,
  **Then** the server sends `Error { code: "INVALID_PLAYER" }` to the caller only; no Guess is recorded.

- **Given** the Jam is not in the Playback phase,
  **When** any Player invokes `SubmitGuess`,
  **Then** the server sends `Error { code: "INVALID_PHASE" }` to the caller only.

### Round Completion

- **Given** all eligible Players — everyone except the submitter of the active Round — have submitted a Guess,
  **When** the last eligible Guess is accepted,
  **Then** the server marks the Round as complete and broadcasts `RoundEnded { roundIndex, correctOwnerId, guesses }` to all Players, revealing who submitted the song and what each Player guessed.

- **Given** a Round has exactly one eligible guesser (a two-Player Jam),
  **When** that sole guesser submits a Guess,
  **Then** the Round is complete and `RoundEnded` is broadcast as above.

---

## Technical Notes

### Architecture placement

Follows the layer responsibilities defined in `docs/solution-architecture.md#layer-responsibilities`. Error codes `ALREADY_GUESSED`, `INVALID_PLAYER`, and `INVALID_PHASE` are specified in `docs/realtime-communication.md#error-code-reference`. `CANNOT_GUESS_OWN_SUBMISSION` is a new error code not yet covered by the Architect docs.

### Prerequisite

Builds on the `Round` entity, `Jam.Rounds`, `Jam.CurrentRoundIndex`, and the `PlaybackComponent` skeleton introduced in **TICKET-010**.

### Files to create or modify

#### Domain — `YtGuessWho.Domain`

| Action | File | Notes |
|--------|------|-------|
| Create | `src/YtGuessWho.Domain/ValueObjects/RoundGuessResult.cs` | Immutable record returned by `JamExtensions.SubmitGuess`. Fields: `IsRoundComplete (bool)`, `CorrectOwnerId (string?)`, `AllGuesses (IReadOnlyDictionary<string, string>?)`. Non-null fields populated only when `IsRoundComplete` is `true`. |
| Create | `src/YtGuessWho.Domain/Exceptions/AlreadyGuessedException.cs` | Thrown when a Player calls `SubmitGuess` after already guessing in the current Round. Inherits `DomainException`. Constructor receives the `playerId`. |
| Create | `src/YtGuessWho.Domain/Exceptions/CannotGuessOwnSubmissionException.cs` | Thrown when the submitter of the active Round calls `SubmitGuess`. Inherits `DomainException`. Constructor receives the `playerId`. |
| Create | `src/YtGuessWho.Domain/Exceptions/InvalidPlayerException.cs` | Thrown when `SubmitGuess` references a `guessedPlayerId` that does not match any Player in the Jam. Inherits `DomainException`. Constructor receives the invalid `guessedPlayerId`. |
| Modify | `src/YtGuessWho.Domain/Extensions/JamExtensions.cs` | Add `SubmitGuess(this Jam jam, string guessingPlayerId, string guessedPlayerId) → RoundGuessResult`. Guards: `ArgumentNullException.ThrowIfNull` for all three parameters; throws `InvalidPhaseTransitionException` if `jam.Phase != JamPhase.Playback`; resolves the active Round via `jam.Rounds[jam.CurrentRoundIndex]`; throws `CannotGuessOwnSubmissionException` if `guessingPlayerId == round.SubmitterPlayerId`; throws `AlreadyGuessedException` if `guessingPlayerId` is already a key in the round's internal Guesses dictionary; throws `InvalidPlayerException` if `guessedPlayerId` does not match any `jam.Players` entry. On success, records the guess in the round's internal Guesses dictionary. Determines whether all eligible Players (all except the submitter) have now guessed. If not complete: returns `RoundGuessResult { IsRoundComplete: false }`. If complete: sets `round.IsComplete = true` (the `internal set` defined in TICKET-010), then returns `RoundGuessResult { IsRoundComplete: true, CorrectOwnerId: round.SubmitterPlayerId, AllGuesses: <snapshot of round.Guesses> }`. No score computation. |

#### Application — `YtGuessWho.Application`

| Action | File | Notes |
|--------|------|-------|
| Create | `src/YtGuessWho.Application/Commands/SubmitGuessCommand.cs` | Immutable record: `ConnectionId (string)`, `GuessedPlayerId (string)`. |
| Create | `src/YtGuessWho.Application/DTOs/RoundEndedInfo.cs` | Immutable record: `RoundIndex (int)`, `CorrectOwnerId (string)`, `AllGuesses (IReadOnlyDictionary<string, string>)`. No `ScoresDelta` — scoring is deferred to a future ticket. |
| Create | `src/YtGuessWho.Application/DTOs/SubmitGuessResult.cs` | Immutable record: `JamCode (string)`, `IsRoundComplete (bool)`, `RoundEnded (RoundEndedInfo?)`. |
| Modify | `src/YtGuessWho.Application/Services/IJamService.cs` | Add `Task<SubmitGuessResult> SubmitGuess(SubmitGuessCommand command, CancellationToken cancellationToken = default)`. Throws `NotInJamException` when the Player is not in a Jam; domain exceptions (`InvalidPhaseTransitionException`, `CannotGuessOwnSubmissionException`, `AlreadyGuessedException`, `InvalidPlayerException`) propagate naturally. |
| Modify | `src/YtGuessWho.Application/Services/Implementations/JamService.cs` | Implement `SubmitGuess`: `FindByPlayerId` — throw `NotInJamException` if null; verify `jam.Phase == JamPhase.Playback` — throw `InvalidPhaseTransitionException` if not; call `jam.SubmitGuess(command.ConnectionId, command.GuessedPlayerId)` — domain exceptions propagate; map `RoundGuessResult` to `SubmitGuessResult`; log `Information`; return. |

#### Infrastructure — `YtGuessWho.Infrastructure`

| Action | File | Notes |
|--------|------|-------|
| Modify | `src/YtGuessWho.Infrastructure/Hubs/GameHub.cs` | Add `SubmitGuess(string guessedPlayerId)` hub method: calls `_jamService.SubmitGuess(new SubmitGuessCommand(Context.ConnectionId, guessedPlayerId), Context.ConnectionAborted)`; on success, broadcasts `GuessSubmitted(new GuessSubmittedPayload(Context.ConnectionId))` to the group; if `result.IsRoundComplete`, also broadcasts `RoundEnded(new RoundEndedPayload(result.RoundEnded.RoundIndex, result.RoundEnded.CorrectOwnerId, result.RoundEnded.AllGuesses, new Dictionary<string, int>()))` to the group (`ScoresDelta` is an empty dictionary — scoring deferred); catches `NotInJamException` → `NOT_IN_JAM`; catches `CannotGuessOwnSubmissionException` → `CANNOT_GUESS_OWN_SUBMISSION`; catches `AlreadyGuessedException` → `ALREADY_GUESSED`; catches `InvalidPlayerException` → `INVALID_PLAYER`; catches `InvalidPhaseTransitionException` → `INVALID_PHASE`. All error paths: send `Error` to caller, throw `HubException`, log `Warning`. |

#### Tests — `YtGuessWho.Tests`

| Action | File | Notes |
|--------|------|-------|
| Create | `tests/YtGuessWho.Tests/Domain/JamSubmitGuessTests.cs` | Cover: valid Guess is recorded and `IsRoundComplete = false` when eligible Players remain; last eligible Guess returns `IsRoundComplete = true` with `CorrectOwnerId` and `AllGuesses` populated and `round.IsComplete` set to `true`; `CannotGuessOwnSubmissionException` when the submitter calls `SubmitGuess`; `AlreadyGuessedException` on a second Guess from the same Player; `InvalidPlayerException` when `guessedPlayerId` is not a Player in the Jam; `InvalidPhaseTransitionException` when the Jam is not in Playback phase; two-Player Jam — single eligible guesser completes the Round. |
| Create | `tests/YtGuessWho.Tests/Application/JamServiceSubmitGuessTests.cs` | Cover: happy path with guesses remaining returns `IsRoundComplete = false`; last eligible Guess returns `RoundEnded` populated on the result; `NotInJamException` when `FindByPlayerId` returns null; `InvalidPhaseTransitionException` when Jam is not in Playback phase; domain exceptions (`CannotGuessOwnSubmissionException`, `AlreadyGuessedException`, `InvalidPlayerException`) propagate without wrapping. |

#### Client — `client/`

| Action | File | Notes |
|--------|------|-------|
| Create | `client/src/app/core/models/round-ended.model.ts` | TypeScript interface `RoundEndedEvent { roundIndex: number; correctOwnerId: string; guesses: Record<string, string> }`. No `scoresDelta` — scoring deferred. |
| Modify | `client/src/app/core/hub-connection.service.ts` | Add `submitGuess(guessedPlayerId: string): Promise<void>` — invokes `'SubmitGuess'` with `guessedPlayerId`. Add `onGuessSubmitted(handler: (payload: { playerId: string }) => void): void`. Add `onRoundEnded(handler: (payload: RoundEndedEvent) => void): void`. All are thin delegations following the established pattern. |
| Modify | `client/src/app/core/hub-connection.service.spec.ts` | Add tests: correct invocation method and event names for each new method; arguments forwarded; `submitGuess` promise resolves and rejects. |
| Modify | `client/src/app/playback/playback.component.ts` | Add signals: `guessedPlayerIds (signal<ReadonlySet<string>>(new Set()))`, `myGuessedPlayerId (signal<string \| null>(null))`, `isSubmittingGuess (signal<boolean>(false))`, `roundResult (signal<RoundEndedEvent \| null>(null))`. In the constructor, register (unregistering on destroy): `onGuessSubmitted` — add `playerId` to `guessedPlayerIds`; `onRoundEnded` — set `roundResult`. Update the existing `onRoundStarted` callback to also reset `guessedPlayerIds`, `myGuessedPlayerId`, and `roundResult` to their initial values, so each Round starts clean. Update template: replace "Waiting for guesses…" with a per-player Guess button list; buttons disabled when `myGuessedPlayerId() !== null` or `isSubmittingGuess()` or `roundResult() !== null`; "N of M have guessed" indicator (`N = guessedPlayerIds().size`, `M = players().length - 1`); when `roundResult()` is non-null, show an inline reveal panel with the correct owner's display name (look up in `players()` by `correctOwnerId`) and each Player's guess. Add `onSubmitGuess(guessedPlayerId: string)`: `isSubmittingGuess(true)`, call `hubService.submitGuess(guessedPlayerId)`, on resolve `myGuessedPlayerId(guessedPlayerId)`, on reject set `errorMessage`, finally `isSubmittingGuess(false)`. |
| Modify | `client/src/app/playback/playback.component.spec.ts` | Add tests: Guess buttons rendered for each player; Guess button disabled after player has guessed; `onSubmitGuess` calls `hubService.submitGuess` with the correct ID and sets `myGuessedPlayerId`; `onGuessSubmitted` adds player to `guessedPlayerIds`; "N of M" indicator reflects `guessedPlayerIds.size`; `onRoundEnded` shows the reveal panel with correct owner name and each player's guess; reveal panel disables remaining Guess buttons; error shown when `submitGuess` rejects. |

### NuGet packages

None.

### Key design constraints

**`CANNOT_GUESS_OWN_SUBMISSION` is a new error code.** Map `CannotGuessOwnSubmissionException` to this string in the Hub catch block. The error code reference in `docs/realtime-communication.md` is a living document; no Architect approval is required for this addition.

**`round.IsComplete = true` must be set inside `JamExtensions.SubmitGuess`.** The `IsComplete` property with `internal set` was declared on `Round` in TICKET-010. Setting it here enables `JamExtensions.AdvancePhase` (TICKET-012) to check completion without recomputing.

**`Round.SubmitterPlayerId` is server-side only.** Guess buttons appear for all Players in the client. The submitter's own attempt is rejected server-side with `CANNOT_GUESS_OWN_SUBMISSION`.

**"N of M have guessed" denominator.** The client uses `players().length - 1` because the submitter is ineligible but unknown to the client (the `RoundStarted` payload is anonymous). This is an acceptable V1 approximation.

**`RoundEndedPayload.ScoresDelta` is passed an empty dictionary.** The existing `RoundEndedPayload` record requires this field. Pass `new Dictionary<string, int>()` until the scoring ticket is implemented.

**The existing `onRoundStarted` handler in `PlaybackComponent` must be extended.** It currently only sets `currentRoundIndex` and `currentYoutubeUrl`. This ticket extends it to also reset `guessedPlayerIds`, `myGuessedPlayerId`, and `roundResult`, so that advancing to the next Round (TICKET-012) starts each Round with clean state.

### Out of scope

- Scoring and `ScoresDelta` — a future ticket.
- Advancing within Playback (next Round) and game end — TICKET-012.
- The "Next Round" button — TICKET-012.

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
- Fresh server start. Reach the Playback view: Alice creates Jam → Bob joins → Alice advances to Submission → both submit valid URLs → Alice advances to Playback.

---

### Scenario 1 — Player Submits a Valid Guess

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Both tabs in Playback view, Round 0 active | Guess buttons visible for Alice and Bob; "0 of 1 have guessed" indicator shown |
| 2 | **Tab B** (Bob): click the Guess button for Alice | Bob's Guess buttons become disabled; both tabs show "1 of 1 have guessed" |
| 3 | Inspect server logs | `Information` entry: SubmitGuess recorded |

---

### Scenario 2 — Round Ends and the Owner Is Revealed

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | All eligible Players have guessed | `RoundEnded` fires automatically |
| 2 | Observe both tabs | Reveal panel appears: correct owner's display name shown; each Player's guess displayed; Guess buttons hidden |
| 3 | Inspect server logs | `Information` entry: RoundEnded; `correctOwnerId` logged |

---

### Scenario 3 — Player Cannot Guess Twice

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Bob has already guessed this Round | Bob's Guess buttons are disabled on **Tab B** |
| 2 | **Tab B** DevTools Console: invoke `SubmitGuess` with any valid `playerId` directly | Error message on **Tab B**: `ALREADY_GUESSED`; no `GuessSubmitted` broadcast |
| 3 | Inspect server logs | `Warning` entry: `ALREADY_GUESSED` |

---

### Scenario 4 — Server Rejects Guessing Your Own Song

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | In Playback; identify the submitter of the active Round from server logs | — |
| 2 | From the submitter's tab: invoke `SubmitGuess` via DevTools Console | Error on the submitter's tab: `CANNOT_GUESS_OWN_SUBMISSION`; no `GuessSubmitted` broadcast |
| 3 | Inspect server logs | `Warning` entry: `CANNOT_GUESS_OWN_SUBMISSION` |

