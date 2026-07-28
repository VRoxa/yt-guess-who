# TICKET-013: Scoring

## User Story

As a Player,
I want to earn points based on whether I guessed correctly and whether others were fooled by my song,
So that I can compete with other Players and see a final leaderboard when the game ends.

---

## Acceptance Criteria

### Points for guessing correctly

- **Given** a Round has ended,
  **When** a Player's Guess matched the correct submitter,
  **Then** that Player earns **+1 point** for this Round.

- **Given** a Round has ended,
  **When** a Player's Guess did not match the correct submitter,
  **Then** that Player earns **0 points** for this Round.

### Points for the submitter

- **Given** a Round has ended and at least one — but not all — eligible Players guessed the submitter's song correctly,
  **When** scores are computed,
  **Then** the submitter earns **+1 point for each correct guess** received (i.e. the number of Players who guessed right, when that number is strictly between 0 and the total eligible count).

- **Given** a Round has ended and **no** eligible Player guessed the song correctly,
  **When** scores are computed,
  **Then** the submitter earns **0 points** — the song was too hard, not clever.

- **Given** a Round has ended and **all** eligible Players guessed the song correctly,
  **When** scores are computed,
  **Then** the submitter earns **0 points** — the song was too obvious.

### Score delta broadcast

- **Given** a Round has ended with a non-zero score delta for at least one Player,
  **When** `RoundEnded` is broadcast,
  **Then** the payload includes `scoresDelta` — a map of `playerId → points earned this Round` containing only Players whose delta is non-zero.

- **Given** a Round has ended with no non-zero deltas (everyone incorrect; or the sole guesser was incorrect),
  **When** `RoundEnded` is broadcast,
  **Then** `scoresDelta` is an empty map.

### Cumulative score and leaderboard

- **Given** multiple Rounds have completed,
  **When** scores are computed after each Round,
  **Then** each Player's total `Score` reflects the sum of all deltas earned across all completed Rounds.

- **Given** all Rounds are complete and the Host advances to the Results phase,
  **When** `GameEnded` is broadcast,
  **Then** the payload includes `finalScores` — an ordered list of `{ playerId, displayName, score }` sorted by `Score` descending.

---

## Technical Notes

### Architecture placement

Follows the layer responsibilities defined in `docs/solution-architecture.md#layer-responsibilities`. Scoring logic is a business invariant and lives exclusively in `JamExtensions` in the Domain layer, per the invariants rule in `docs/solution-architecture.md#invariants--business-rules-location`.

### Prerequisites

- **TICKET-011** — `JamExtensions.SubmitGuess` detects round completion and returns `RoundGuessResult`. This ticket adds `ScoresDelta` to that result and applies it to `Player.Score`.
- **TICKET-012** — `JamService.AdvancePhase` returns `AdvancePhaseResult` with `IsGameOver`. This ticket adds `FinalScores` to that result.
- Both tickets leave stub empty dictionaries/lists in the Hub; this ticket replaces all of them with real data.

### Files to create or modify

#### Domain — `YtGuessWho.Domain`

| Action | File | Notes |
|--------|------|-------|
| Modify | `src/YtGuessWho.Domain/Entities/Player.cs` | Widen `Score` setter from `private set` to `internal set`. Required so `JamExtensions.SubmitGuess` can apply score deltas after a completed Round. |
| Modify | `src/YtGuessWho.Domain/ValueObjects/RoundGuessResult.cs` | Add `ScoresDelta (IReadOnlyDictionary<string, int>?)` — populated (possibly empty) when `IsRoundComplete` is `true`; `null` otherwise. |
| Modify | `src/YtGuessWho.Domain/Extensions/JamExtensions.cs` | Extend the round-completion branch inside `SubmitGuess` (currently returns `RoundGuessResult` with `null` `ScoresDelta`). After recording the final guess and setting `round.IsComplete = true`, compute the score delta using the rules below, apply each delta to the corresponding `Player.Score`, and include the delta map in the returned `RoundGuessResult`. **Scoring rules:** let `correctCount` = number of entries in `round.Guesses` whose value equals `round.SubmitterPlayerId`; let `totalEligible` = `jam.Players.Count - 1`. For each guesser: if their guess equals `round.SubmitterPlayerId`, add `+1` to their delta. For the submitter: if `0 < correctCount < totalEligible`, add `+correctCount` to their delta; otherwise `0`. `ScoresDelta` contains only Players whose delta is strictly greater than zero. Apply each delta to `player.Score += delta` for affected Players. |

#### Application — `YtGuessWho.Application`

| Action | File | Notes |
|--------|------|-------|
| Modify | `src/YtGuessWho.Application/DTOs/RoundEndedInfo.cs` | Add `ScoresDelta (IReadOnlyDictionary<string, int>)` — passed through from `RoundGuessResult.ScoresDelta`. |
| Create | `src/YtGuessWho.Application/DTOs/PlayerScoreInfo.cs` | Immutable record: `PlayerId (string)`, `DisplayName (string)`, `Score (int)`. Used in the final leaderboard. |
| Modify | `src/YtGuessWho.Application/DTOs/AdvancePhaseResult.cs` | Add `IReadOnlyList<PlayerScoreInfo>? FinalScores` — non-null only when `IsGameOver` is `true`. |
| Modify | `src/YtGuessWho.Application/Services/Implementations/JamService.cs` | **Two changes:** (1) In `SubmitGuess`: map `domainResult.ScoresDelta` through to `RoundEndedInfo` — pass it directly (`domainResult.ScoresDelta ?? empty`). (2) In `AdvancePhase`: when `domainResult.IsGameOver` is `true`, compute `FinalScores` from `jam.Players` ordered by `Score` descending, projecting to `PlayerScoreInfo`. |

#### Infrastructure — `YtGuessWho.Infrastructure`

| Action | File | Notes |
|--------|------|-------|
| Modify | `src/YtGuessWho.Infrastructure/Hubs/GameHub.cs` | **Two changes:** (1) In `SubmitGuess`: replace `new Dictionary<string, int>()` with `result.RoundEnded!.ScoresDelta` when constructing `RoundEndedPayload`. (2) In `AdvancePhase`: replace `new GameEndedPayload([])` with `new GameEndedPayload(result.FinalScores!.Select(s => new PlayerFinalScore(s.PlayerId, s.DisplayName, s.Score)).ToList())`. |

#### Tests — `YtGuessWho.Tests`

| Action | File | Notes |
|--------|------|-------|
| Modify | `tests/YtGuessWho.Tests/Domain/JamSubmitGuessTests.cs` | Add scoring tests: correct guesser earns `+1` and `ScoresDelta` entry exists; incorrect guesser earns `0` and no `ScoresDelta` entry; submitter earns `+correctCount` when `0 < correctCount < totalEligible`; submitter earns `0` when no correct guesses; submitter earns `0` when all guessers are correct; `Player.Score` is updated on the domain object; `ScoresDelta` contains only non-zero entries; three-Player Jam — one correct guesser out of two gives submitter `+1`; two-Player Jam — sole guesser correct gives submitter `0` (all guessed correctly); two-Player Jam — sole guesser incorrect gives submitter `0` (none guessed correctly); score accumulates across multiple Rounds (call `SubmitGuess` twice on the same Jam). |
| Modify | `tests/YtGuessWho.Tests/Application/JamServiceSubmitGuessTests.cs` | Add: `ScoresDelta` from domain result is present in `RoundEndedInfo` when the round is complete; empty `ScoresDelta` is passed through without modification. |
| Modify | `tests/YtGuessWho.Tests/Application/JamServiceAdvancePhaseTests.cs` | Add: final-Round advance returns `FinalScores` populated with all Players' `PlayerId`, `DisplayName`, and `Score`, ordered by `Score` descending. |

#### Client — `client/`

| Action | File | Notes |
|--------|------|-------|
| Modify | `client/src/app/core/models/round-ended.model.ts` | Add `scoresDelta: Record<string, number>` to `RoundEndedEvent`. |
| Modify | `client/src/app/core/models/game-ended.model.ts` | Replace the empty marker interface with `GameEndedEvent { finalScores: FinalScore[] }` and add `FinalScore { playerId: string; displayName: string; score: number }`. |
| Modify | `client/src/app/playback/playback.component.ts` | **Two additions to the template:** (1) In the reveal panel (when `roundResult()` is non-null): next to each Player's name, show their score delta from `roundResult().scoresDelta` — e.g. "+1" when the entry exists and is non-zero, nothing when the Player is absent from the map. (2) When `gameOver()` is `true`: replace the plain "Game over!" message with a leaderboard table listing each entry from `gameResult().finalScores` in order (position, display name, total score). Add `gameResult (signal<GameEndedEvent \| null>(null))` signal. Update the `onGameEnded` handler (currently `gameOver.set(true)`) to also set `gameResult(payload)`. |
| Modify | `client/src/app/playback/playback.component.spec.ts` | Add tests: reveal panel shows "+1" next to a Player when their `playerId` appears in `scoresDelta`; no delta shown for a Player absent from the map; `onGameEnded` with a payload shows the leaderboard with player names and scores in order. |

### NuGet packages

None.

### Key design constraints

**Scoring rules are domain invariants.** All computation lives in `JamExtensions.SubmitGuess`. The application service and Hub are purely pass-through for scores — they never recompute or interpret the delta map.

**`Player.Score` setter widening.** Widening from `private set` to `internal set` follows the same pattern used for `Player.Submission` in TICKET-009 and `Player.IsHost`.

**`ScoresDelta` contains only non-zero deltas.** The Hub passes the map straight to the client payload without filtering. The client must treat the absence of a `playerId` key as a zero delta.

**Two-Player Jam edge case.** With only one eligible guesser, `totalEligible = 1`. A correct guess means `correctCount = 1 = totalEligible` → submitter gets `0` (all guessed correctly). An incorrect guess means `correctCount = 0` → submitter gets `0` (none guessed correctly). The submitter can never earn points in a two-Player Jam; this is the intended behaviour of the scoring rules.

**`FinalScores` ordering.** Players are ordered by `Score` descending. Ties preserve the order returned by `jam.Players` (insertion order). No tie-breaking rule beyond this is required for V1.

**Stub replacements in the Hub are the only Infrastructure changes.** Both stubs (`new Dictionary<string, int>()` in `SubmitGuess` and `new GameEndedPayload([])` in `AdvancePhase`) were placed in TICKET-011 and TICKET-012 precisely to be replaced here. No other Hub logic changes.

### Out of scope

- Score bonuses beyond the rules above (e.g. speed bonuses, streak bonuses).
- Per-round score history visible to Players during the game.
- Tie-breaking beyond insertion order in the leaderboard.
- Persisting scores across Jams or to a database.

---

## Test Plan

> **For the human tester only.**
> Manual verification steps to execute after the Dev has finished with both services running.

### Tooling

- Server running via `dotnet run` from `server/src/YtGuessWho.Api/` (default port `5030`).
- Angular dev server running via `pnpm start` from `client/` (`http://localhost:4200`).
- **Three** browser tabs recommended for interesting scoring scenarios: **Tab A** (Alice / Host), **Tab B** (Bob), **Tab C** (Carol).
- Server terminal visible for log inspection.

### Preconditions

- Both services running with no startup errors.
- Fresh server start.
- Reach a completed Round: all Players create/join the Jam → advance to Submission → all submit URLs → advance to Playback → all eligible Players submit Guesses.

---

### Scenario 1 — Correct Guesser Earns +1 and Submitter Earns Points When Some (Not All) Guess Correctly

Setup: Three Players (Alice Host, Bob, Carol). Each submits a URL. Round 0 plays — it belongs to Alice.

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | **Tab B** (Bob): click "Guess: Alice" (correct) | `GuessSubmitted` shown; "1 of 2 have guessed" |
| 2 | **Tab C** (Carol): click "Guess: Bob" (incorrect) | `GuessSubmitted` shown; "2 of 2 have guessed"; `RoundEnded` fires |
| 3 | Observe reveal panel on all tabs | `scoresDelta` shows Bob `+1`; Alice `+1`; Carol absent (no delta) |
| 4 | Inspect server logs | `ScoresDelta` entry: `{ "<Bob's id>": 1, "<Alice's id>": 1 }` |

---

### Scenario 2 — No Points When Nobody Guesses Correctly

Setup: Two Players (Alice Host, Bob). Round belongs to Alice. Bob guesses Carol (wrong).

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | **Tab B** (Bob): click "Guess: Carol" — any incorrect player | `RoundEnded` fires |
| 2 | Observe reveal panel | `scoresDelta` is empty — no `+` indicators next to any player |
| 3 | Inspect server logs | `ScoresDelta` entry: `{}` |

---

### Scenario 3 — No Points for Submitter When Everyone Guesses Correctly

Setup: Two Players (Alice Host, Bob). Round belongs to Alice. Bob guesses Alice (correct).

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | **Tab B** (Bob): click "Guess: Alice" (correct) | `RoundEnded` fires |
| 2 | Observe reveal panel | Bob shows `+1`; Alice shows no delta (`totalEligible = 1`, `correctCount = 1` — all correct, so submitter earns 0) |
| 3 | Inspect server logs | `ScoresDelta` entry: `{ "<Bob's id>": 1 }` — Alice absent |

---

### Scenario 4 — Scores Accumulate Across Rounds and Final Leaderboard Is Correct

Setup: Three Players, two Rounds completed. Alice earned 2 points total, Bob earned 1, Carol earned 0.

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Complete both Rounds | Reveal panel after each Round shows deltas |
| 2 | **Tab A**: click "Next Round" after Round 0 ends; complete Round 1; click "Next Round" on final Round | Both tabs receive `PhaseChanged(Results)` and `GameEnded` |
| 3 | Observe leaderboard on all tabs | Players listed in descending score order: Alice (2), Bob (1), Carol (0) |
| 4 | Inspect server logs | `FinalScores` logged in order |

