# TICKET-009: Submission Phase — Advance Phase and Submit Songs

## User Story

As a Host,
I want to advance the Jam from the Lobby to the Submission phase,
So that all Players can start submitting their songs.

As a Player in the Submission phase,
I want to submit a YouTube URL,
So that my song is registered for the round and the group can see how many Players have submitted.

---

## Acceptance Criteria

### Phase advance

- **Given** the Jam is in the Lobby phase and the current Player is the Host,
  **When** the Host clicks **Start Submissions**,
  **Then** the server advances the Jam to the Submission phase and broadcasts `PhaseChanged { newPhase: "Submission" }` to all Players in the Jam; every connected client transitions to the Submission view.

- **Given** the Jam is in the Lobby phase and the current Player is not the Host,
  **When** the non-Host Player invokes `AdvancePhase`,
  **Then** the server sends `Error { code: "UNAUTHORIZED" }` to the caller only; no phase transition occurs; no broadcast is sent.

- **Given** the Jam is not in the Lobby phase,
  **When** any Player invokes `AdvancePhase`,
  **Then** the server sends `Error { code: "INVALID_PHASE" }` to the caller only; no phase transition occurs.

- **Given** the Jam is in the Lobby phase,
  **When** the Host clicks **Start Submissions** and the request is in flight,
  **Then** the **Start Submissions** button is disabled until the request settles.

### Song submission

- **Given** the Jam is in the Submission phase,
  **When** a Player submits a valid YouTube URL,
  **Then** the server records the Submission against that Player and broadcasts `SongSubmitted { playerId }` to all Players in the Jam; the submitting Player's entry in the progress list is marked as submitted on every connected client.

- **Given** the Jam is in the Submission phase and a Player has already submitted,
  **When** the same Player invokes `SubmitSong` again,
  **Then** the server sends `Error { code: "ALREADY_SUBMITTED" }` to the caller only; no second Submission is recorded.

- **Given** the Jam is in the Submission phase,
  **When** a Player submits a string that is not a valid YouTube URL,
  **Then** the server sends `Error { code: "INVALID_YOUTUBE_URL" }` to the caller only; no Submission is recorded; the client displays an inline error message.

- **Given** the Jam is not in the Submission phase,
  **When** any Player invokes `SubmitSong`,
  **Then** the server sends `Error { code: "INVALID_PHASE" }` to the caller only.

- **Given** all Players in the Jam have submitted their URL,
  **When** the last Submission is accepted,
  **Then** the server broadcasts `AllSubmissionsReceived` (no payload) to all Players in the Jam; every connected client transitions to a "waiting" state indicating all songs are in.

- **Given** a Player is in the Submission view,
  **When** the Player has not yet submitted,
  **Then** the Submit button is enabled when the URL input is non-empty and disabled while the request is in flight.

- **Given** a Player is in the Submission view,
  **When** the Player has successfully submitted,
  **Then** the Submit button and URL input are no longer interactive; the UI shows that this Player has submitted.

---

## Technical Notes

### Architecture placement

Follows the layer responsibilities in `docs/solution-architecture.md#layer-responsibilities`. The `AdvancePhase` auth rule and the `SubmitSong` phase guard are defined in `docs/realtime-communication.md#gamehub--client-callable-methods`. Error codes `UNAUTHORIZED`, `INVALID_PHASE`, `INVALID_YOUTUBE_URL`, and `ALREADY_SUBMITTED` are in `docs/realtime-communication.md#error-code-reference`.

### Files to create or modify

#### Domain — `YtGuessWho.Domain`

| Action | File | Notes |
|--------|------|-------|
| Create | `src/YtGuessWho.Domain/ValueObjects/YoutubeUrl.cs` | Immutable value object wrapping a validated YouTube URL string. Constructor accepts a raw string and throws `InvalidYoutubeUrlException` if it does not match an accepted YouTube URL pattern. Accepted formats: standard watch URL (`youtube.com/watch?v=…`), short URL (`youtu.be/…`), and Shorts URL (`youtube.com/shorts/…`). Both `http` and `https` schemes are accepted. Exposes a single `Value (string)` property. |
| Create | `src/YtGuessWho.Domain/Exceptions/InvalidPhaseTransitionException.cs` | Thrown when a phase transition is attempted from an invalid current phase. Inherits `DomainException`. Constructor receives the current `JamPhase`. |
| Create | `src/YtGuessWho.Domain/Exceptions/UnauthorizedHostActionException.cs` | Thrown when a non-Host Player attempts a Host-only action. Inherits `DomainException`. Constructor receives the `connectionId` of the unauthorised caller. |
| Create | `src/YtGuessWho.Domain/Exceptions/AlreadySubmittedException.cs` | Thrown when a Player calls `SubmitSong` after already having submitted in this Jam. Inherits `DomainException`. Constructor receives the `playerId`. |
| Create | `src/YtGuessWho.Domain/Exceptions/InvalidYoutubeUrlException.cs` | Thrown by the `YoutubeUrl` constructor when the provided string does not match an accepted YouTube URL pattern. Inherits `DomainException`. Constructor receives the invalid raw string. |
| Modify | `src/YtGuessWho.Domain/Entities/Player.cs` | Change `Submission` property type from `string?` to `YoutubeUrl?`. Widen its setter from `private set` to `internal set` — required by `PlayerExtensions.SubmitSong` introduced in this ticket. Remove the existing "Will be replaced by a typed YoutubeUrl value object" comment. |
| Modify | `src/YtGuessWho.Domain/Extensions/JamExtensions.cs` | Add `AdvancePhase(this Jam jam, string requestingPlayerId)`. Guards: `ArgumentNullException.ThrowIfNull` on both args; throws `UnauthorizedHostActionException` if no Player with `requestingPlayerId` has `IsHost = true`; throws `InvalidPhaseTransitionException` if `jam.Phase != JamPhase.Lobby` — this ticket advances Lobby → Submission only; sets `jam.Phase = JamPhase.Submission`. |
| Modify | `src/YtGuessWho.Domain/Extensions/PlayerExtensions.cs` | Add `SubmitSong(this Player player, string youtubeUrl)`. Guards: `ArgumentNullException.ThrowIfNull` on both args; throws `AlreadySubmittedException` if `player.Submission is not null`; constructs `new YoutubeUrl(youtubeUrl)` — this throws `InvalidYoutubeUrlException` if invalid; sets `player.Submission = new YoutubeUrl(youtubeUrl)`. |

#### Application — `YtGuessWho.Application`

| Action | File | Notes |
|--------|------|-------|
| Create | `src/YtGuessWho.Application/Commands/AdvancePhaseCommand.cs` | Immutable record: `ConnectionId (string)`. |
| Create | `src/YtGuessWho.Application/Commands/SubmitSongCommand.cs` | Immutable record: `ConnectionId (string)`, `YoutubeUrl (string)` (raw string; `YoutubeUrl` value object is constructed in the Domain layer). |
| Create | `src/YtGuessWho.Application/DTOs/SubmitSongResult.cs` | Immutable record: `AllSubmissionsReceived (bool)`. `true` when the just-accepted Submission was the last one outstanding. |
| Modify | `src/YtGuessWho.Application/Services/IJamService.cs` | Add `Task<JamPhase> AdvancePhase(AdvancePhaseCommand command, CancellationToken cancellationToken = default)`. Returns the new `JamPhase` so the Hub can include it in the broadcast. Throws `NotInJamException` when `FindByPlayerId` returns null; domain exceptions (`UnauthorizedHostActionException`, `InvalidPhaseTransitionException`) propagate naturally. Add `Task<SubmitSongResult> SubmitSong(SubmitSongCommand command, CancellationToken cancellationToken = default)`. Throws `NotInJamException` when the caller is not in any Jam; domain exceptions (`AlreadySubmittedException`, `InvalidPhaseTransitionException`, `InvalidYoutubeUrlException`) propagate naturally. |
| Modify | `src/YtGuessWho.Application/Services/Implementations/JamService.cs` | Implement `AdvancePhase`: (1) `FindByPlayerId` — throw `NotInJamException` if null; (2) call `jam.AdvancePhase(command.ConnectionId)` (domain extension — throws on violation); (3) log `Information`; (4) return `jam.Phase`. Implement `SubmitSong`: (1) `FindByPlayerId` — throw `NotInJamException` if null; (2) find the Player in `jam.Players` by `command.ConnectionId` — throw `NotInJamException` if not found; (3) call `player.SubmitSong(command.YoutubeUrl)` (domain extension — throws on violation); (4) determine whether all Players now have a non-null `Submission`; (5) log `Information`; (6) return `new SubmitSongResult(allSubmitted)`. |

#### Infrastructure — `YtGuessWho.Infrastructure`

| Action | File | Notes |
|--------|------|-------|
| Modify | `src/YtGuessWho.Infrastructure/Hubs/Payloads/GameHubPayloads.cs` | Add `SongSubmittedPayload(string PlayerId)`. This event signals to peers that a Player has submitted, without revealing the URL. |
| Modify | `src/YtGuessWho.Infrastructure/Hubs/IGameHubClient.cs` | Add `Task SongSubmitted(SongSubmittedPayload payload)`. This is a new event not yet in the Architect docs — add it before writing the Hub logic. |
| Modify | `src/YtGuessWho.Infrastructure/Hubs/GameHub.cs` | Add `AdvancePhase()` hub method: calls `_jamService.AdvancePhase(new AdvancePhaseCommand(Context.ConnectionId), Context.ConnectionAborted)`; on success, broadcasts `Clients.Group(jamCode).PhaseChanged(new PhaseChangedPayload(result.ToString()))` — the jam code must first be retrieved from the Jam (the service should return it, or a second lookup is done before the call); catches `NotInJamException` → `NOT_IN_JAM` error + `HubException`; catches `UnauthorizedHostActionException` → `UNAUTHORIZED` error + `HubException`; catches `InvalidPhaseTransitionException` → `INVALID_PHASE` error + `HubException`. Add `SubmitSong(string youtubeUrl)` hub method: calls `_jamService.SubmitSong(new SubmitSongCommand(Context.ConnectionId, youtubeUrl), Context.ConnectionAborted)`; on success, retrieves jam code (same pattern as AdvancePhase), broadcasts `SongSubmitted(new SongSubmittedPayload(Context.ConnectionId))` to group; if `result.AllSubmissionsReceived`, also broadcasts `Clients.Group(jamCode).AllSubmissionsReceived()`; catches `NotInJamException` → `NOT_IN_JAM`; catches `AlreadySubmittedException` → `ALREADY_SUBMITTED`; catches `InvalidYoutubeUrlException` → `INVALID_YOUTUBE_URL`; catches `InvalidPhaseTransitionException` → `INVALID_PHASE`. All error paths: send `Error` to caller, throw `HubException`, log `Warning`. |

> **Hub design note — retrieving the Jam code for group broadcasts.** `AdvancePhase` and `SubmitSong` both need the Jam's code to call `Clients.Group(jamCode)`. The service return types currently carry only the phase and submission result. Either: (a) extend the service return types to include the `JamCode` string, or (b) call `_jamService.FindJamCode(Context.ConnectionId)` (add a focused method to `IJamService`). Option (a) is preferred — the Dev should add `JamCode (string)` to the result records returned by both methods, keeping the Hub free of secondary lookups.

#### Tests — `YtGuessWho.Tests`

| Action | File | Notes |
|--------|------|-------|
| Create | `tests/YtGuessWho.Tests/Domain/YoutubeUrlTests.cs` | Cover: valid standard URL parses; valid short URL (`youtu.be`) parses; valid Shorts URL parses; `http` scheme accepted; `Value` property holds the original string; empty string throws `InvalidYoutubeUrlException`; non-YouTube URL throws `InvalidYoutubeUrlException`; null throws `ArgumentNullException`. |
| Modify | `tests/YtGuessWho.Tests/Domain/JamTests.cs` | Add tests for `JamExtensions.AdvancePhase`. Cover: advances phase from Lobby to Submission; throws `UnauthorizedHostActionException` when caller is not the Host; throws `InvalidPhaseTransitionException` when Jam is not in Lobby phase; throws `ArgumentNullException` for null `jam`; throws `ArgumentNullException` for null `requestingPlayerId`. |
| Create | `tests/YtGuessWho.Tests/Domain/PlayerExtensionsSubmitSongTests.cs` | Cover: sets `Submission` on the Player after a valid URL; throws `AlreadySubmittedException` when `Submission` is already set; throws `InvalidYoutubeUrlException` for an invalid URL (delegates to `YoutubeUrl` VO); throws `ArgumentNullException` for null `player`; throws `ArgumentNullException` for null `youtubeUrl`. |
| Create | `tests/YtGuessWho.Tests/Application/JamServiceAdvancePhaseTests.cs` | Cover: returns `JamPhase.Submission` on success; throws `NotInJamException` when `FindByPlayerId` returns null; domain exceptions propagate without wrapping. |
| Create | `tests/YtGuessWho.Tests/Application/JamServiceSubmitSongTests.cs` | Cover: `AllSubmissionsReceived = false` when not all Players have submitted; `AllSubmissionsReceived = true` when the last Player submits; throws `NotInJamException` when `FindByPlayerId` returns null; domain exceptions propagate without wrapping. |

#### Client — `client/`

| Action | File | Notes |
|--------|------|-------|
| Modify | `client/src/app/core/hub-connection.service.ts` | Add `getConnectionId(): string \| null` — returns `this.#connection.connectionId`. Add `advancePhase(): Promise<void>` — invokes `'AdvancePhase'`. Add `submitSong(youtubeUrl: string): Promise<void>` — invokes `'SubmitSong'` with `youtubeUrl`. Add `onPhaseChanged(handler: (payload: { newPhase: string }) => void): void` — registers `'PhaseChanged'`. Add `onSongSubmitted(handler: (payload: { playerId: string }) => void): void` — registers `'SongSubmitted'`. Add `onAllSubmissionsReceived(handler: () => void): void` — registers `'AllSubmissionsReceived'`. All are thin delegations only. |
| Modify | `client/src/app/core/hub-connection.service.spec.ts` | Add tests for each new method following the established pattern: correct method/event name, arguments forwarded, resolved/rejected promise behaviour. |
| Modify | `client/src/app/lobby/lobby.component.ts` | Add signals: `myPlayerId = signal<string \| null>(null)` — set from `hubService.getConnectionId()` at the point `jamCode` is confirmed (after `createJam()` or `joinJam()` resolves); `isHost = signal<boolean>(false)` — `true` immediately after `createJam()` resolves, `false` after `joinJam()` resolves, updated in the `onHostChanged` handler when `payload.newHostPlayerId === myPlayerId()`; `currentPhase = signal<string>('Lobby')`; `submittedPlayerIds = signal<ReadonlySet<string>>(new Set())`; `submissionUrl = signal<string>('')`; `isSubmitting = signal<boolean>(false)`; `isAdvancingPhase = signal<boolean>(false)`; `allSubmissionsReceived = signal<boolean>(false)`. In the constructor, register: `onPhaseChanged` → `currentPhase.set(payload.newPhase)`; `onSongSubmitted` → `submittedPlayerIds.update(ids => new Set([...ids, payload.playerId]))`; `onAllSubmissionsReceived` → `allSubmissionsReceived.set(true)`. Update the existing `onHostChanged` handler to also set `isHost.set(payload.newHostPlayerId === myPlayerId())`. Add `onAdvancePhase()` method: set `isAdvancingPhase(true)`, call `hubService.advancePhase()`, on reject set `errorMessage`, always `finally` set `isAdvancingPhase(false)`. Add `onSubmitSong()` method: set `isSubmitting(true)`, call `hubService.submitSong(submissionUrl().trim())`, on resolve clear `errorMessage`, on reject set `errorMessage`, always `finally` set `isSubmitting(false)`. In the in-jam template: add **Start Submissions** button visible only when `currentPhase() === 'Lobby' && isHost()`, disabled when `isAdvancingPhase()`. Add a Submission phase view (`@if (currentPhase() === 'Submission')`) containing: a URL input bound to `submissionUrl`, a **Submit** button disabled when `submissionUrl().trim()` is empty or `isSubmitting()` or the current player has already submitted (i.e. `submittedPlayerIds().has(myPlayerId() ?? '')`), a per-player submission progress list derived from `players()` showing a submitted/pending indicator per player based on `submittedPlayerIds()`, and an "All songs are in!" message visible when `allSubmissionsReceived()` is true. |
| Modify | `client/src/app/lobby/lobby.component.spec.ts` | Add tests: **Start Submissions** button visible when `currentPhase` is Lobby and `isHost` is true; not visible when `isHost` is false; not visible when `currentPhase` is Submission; clicking it calls `hubService.advancePhase()`; disabled while `isAdvancingPhase` is true; `onPhaseChanged` event with `'Submission'` transitions to the Submission view; Submission view shows URL input and Submit button; Submit disabled when URL empty; Submit disabled when player already in `submittedPlayerIds`; `onSubmitSong()` calls `hubService.submitSong` with trimmed URL; `onSongSubmitted` event adds `playerId` to the submitted set; `onAllSubmissionsReceived` event shows the "all in" message; error message shown when `advancePhase` or `submitSong` rejects. |

### NuGet packages

None — no new server-side packages required.

### Key design constraints

**`SongSubmitted` is a new event not yet in the Architect docs.** Add it to `IGameHubClient` before writing `GameHub.SubmitSong`. The payload carries only `playerId` — the URL is never revealed to peers.

**`Player.Submission` widened to `internal set` in this ticket.** This is justified by `PlayerExtensions.SubmitSong`, which is introduced here. Per rule 15 of `docs/guidelines/csharp-coding-standards.md §2.3`, visibility is widened only when the ticket that requires it is being implemented.

**`YoutubeUrl` replaces the `string?` placeholder.** `Player.Submission` changes type from `string?` to `YoutubeUrl?`. Any existing tests that set or assert `Player.Submission` as a raw string must be updated.

**`JamExtensions.AdvancePhase` is scoped to Lobby → Submission.** It throws `InvalidPhaseTransitionException` for any phase other than `Lobby`. The extension will be extended in the Playback ticket to handle the next transition.

**The Hub needs the Jam code to call `Clients.Group(jamCode)`.** Extend `AdvancePhase` and `SubmitSong` service return types to carry `JamCode (string)` alongside their existing fields. This avoids secondary repository lookups in the Hub layer.

**`myPlayerId` is obtained from `hubService.getConnectionId()`** — the SignalR `HubConnection.connectionId` property is available on the client after the connection is started, and matches the `Context.ConnectionId` the server uses as `PlayerId`. Set `myPlayerId` after `createJam()` or `joinJam()` resolves, at which point the connection is guaranteed to be active.

**`AllSubmissionsReceived` carries no payload.** `IGameHubClient.AllSubmissionsReceived()` takes no arguments. The client handler must be registered with `this.#connection.on('AllSubmissionsReceived', handler)` where `handler` is a zero-argument function.

### Out of scope

- Advancing from Submission → Playback (separate ticket).
- Minimum player count before the Host can advance.
- Any constraint requiring the Host to also submit a song.
- YouTube URL reachability or iframe validity — URL format validation only.
- Displaying the submitted URL to the submitting Player after submission.

---

## Test Plan

> **For the human tester only.**
> Manual verification steps to execute after the Dev has finished, with both services running.

### Tooling

- Server running via `dotnet run` from `server/src/YtGuessWho.Api/` (default port `5030`).
- Angular dev server running via `pnpm start` from `client/` (`http://localhost:4200`).
- Two browser tabs: **Tab A** (Alice / Host), **Tab B** (Bob).
- Server terminal visible for log inspection.

### Preconditions

- Server and Angular dev server running with no startup errors.
- Both tabs load `http://localhost:4200` without console errors.
- No active Jams exist (fresh server start).

---

### Scenario 1 — Host Advances to Submission Phase

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | **Tab A**: enter `Alice`, click **Create Jam** | Jam code shown; player list: `[Alice (Host)]`; **Start Submissions** button visible |
| 2 | **Tab B**: enter `Bob`, enter the Jam code, click **Join Jam** | Both tabs show `[Alice (Host), Bob]`; **Tab B** does NOT show a **Start Submissions** button |
| 3 | **Tab A**: click **Start Submissions** | Button becomes disabled immediately |
| 4 | Wait for response | Both tabs transition to the Submission view; **Start Submissions** button is gone; a YouTube URL input and **Submit** button are visible on both tabs |
| 5 | Inspect server logs | `Information`-level entry confirms phase advanced to Submission |

---

### Scenario 2 — Non-Host Cannot Advance Phase

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Create Jam as Alice (**Tab A**), join as Bob (**Tab B**) | Both in Lobby |
| 2 | Open **Tab B** DevTools Console and run: `ng.getComponent(document.querySelector('app-lobby')).onAdvancePhase()` | — |
| 3 | Observe **Tab B** | An error message appears; the Jam remains in the Lobby phase on both tabs |
| 4 | Inspect server logs | `Warning`-level entry records `UNAUTHORIZED` rejection |

---

### Scenario 3 — Player Submits a Valid YouTube URL

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Create Jam (Alice), join (Bob), advance to Submission phase | Both tabs in Submission view |
| 2 | **Tab A**: paste `https://www.youtube.com/watch?v=dQw4w9WgXcQ` into the URL input | Submit button becomes enabled |
| 3 | **Tab A**: click **Submit** | Button becomes disabled immediately |
| 4 | Wait for response | Both **Tab A** and **Tab B** show Alice's entry as "submitted" in the progress list; **Tab A**'s input and Submit button become non-interactive |
| 5 | Inspect server logs | `Information`-level entry records Alice's Submission |

---

### Scenario 4 — Invalid YouTube URL Is Rejected

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Both tabs in Submission view | — |
| 2 | **Tab A**: type `https://www.google.com` into the URL input, click **Submit** | — |
| 3 | Observe **Tab A** | Inline error message: invalid YouTube URL; Submission not recorded; Submit button re-enabled |
| 4 | Observe **Tab B** | No change — no broadcast was sent |
| 5 | Inspect server logs | `Warning`-level entry records `INVALID_YOUTUBE_URL` rejection |

---

### Scenario 5 — Player Cannot Submit Twice

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Both tabs in Submission view; Alice has already submitted | Alice's Submit button and input are non-interactive |
| 2 | Open **Tab A** DevTools Console and run: `ng.getComponent(document.querySelector('app-lobby')).onSubmitSong()` | — |
| 3 | Observe **Tab A** | Error message appears: already submitted |
| 4 | Inspect server logs | `Warning`-level entry records `ALREADY_SUBMITTED` rejection |

---

### Scenario 6 — All Submissions Received

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Both tabs in Submission view | Progress list shows 0 of 2 submitted |
| 2 | **Tab A** (Alice): submit a valid URL | Both tabs update: Alice marked as submitted; progress shows 1 of 2 |
| 3 | **Tab B** (Bob): submit a valid URL | Both tabs update: Bob marked as submitted; progress shows 2 of 2; "All songs are in!" message appears on both tabs |
| 4 | Inspect server logs | `Information`-level entry confirms `AllSubmissionsReceived` was broadcast |

---

### Scenario 7 — Start Submissions Button Disabled During Request

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Alice and Bob in Lobby; **Tab A** shows **Start Submissions** | Button enabled |
| 2 | Using DevTools, throttle **Tab A** network to **Slow 3G** | — |
| 3 | Click **Start Submissions** | Button becomes disabled immediately |
| 4 | While in flight, attempt to click the disabled button | Nothing happens |
| 5 | Wait for response; remove throttle | Both tabs transition to Submission view |

