# TICKET-006: Join a Jam

## User Story

As a Player,
I want to enter a Jam code and join an existing Jam with a single button click,
So that I can participate in a game session created by another Player.

---

## Acceptance Criteria

- **Given** the application is connected and a Jam in the `Lobby` phase exists,
  **When** a Player enters a valid Jam code and a display name and clicks **Join Jam**,
  **Then** the server adds the Player to the Jam, and the UI shows the Jam code prominently as confirmation.

- **Given** the application is connected,
  **When** the display name input is empty,
  **Then** the **Join Jam** button is disabled and no hub invocation is made.

- **Given** the application is connected,
  **When** the Jam code input is empty,
  **Then** the **Join Jam** button is disabled and no hub invocation is made.

- **Given** the Player has clicked **Join Jam** and the request is in-flight,
  **When** the server has not yet responded,
  **Then** the **Join Jam** button is disabled for the entire duration — no double-submission is possible.

- **Given** the Player enters a Jam code that does not match any active Jam,
  **When** they click **Join Jam**,
  **Then** an error message is displayed on screen indicating the Jam was not found.

- **Given** the Player is already associated with an active Jam,
  **When** they attempt to join another Jam,
  **Then** an error message is displayed on screen indicating they are already in a Jam.

- **Given** a Jam exists but is not in the `Lobby` phase,
  **When** a Player attempts to join it,
  **Then** an error message is displayed on screen indicating the Jam cannot be joined.

- **Given** a Player successfully joins a Jam,
  **When** the server persists the change,
  **Then** the Jam's Players list contains a new entry for the joining Player — with `PlayerId` equal to the caller's `ConnectionId`, the provided `displayName`, `IsHost = false`, and `Score = 0`.

---

## Technical Notes

### Architecture placement

This ticket spans all four server layers plus the client, following the same pattern established in
ticket-005. Layer responsibilities and SignalR hub design constraints are defined in
`docs/solution-architecture.md#layer-responsibilities` and `docs/realtime-communication.md#hub-design`.

### Files to create or modify

#### Domain — `YtGuessWho.Domain`

| Action | File | Notes |
|--------|------|-------|
| Create | `src/YtGuessWho.Domain/Exceptions/DomainException.cs` | Abstract base exception for all domain invariant violations. Follows the rule in `docs/guidelines/csharp-coding-standards.md` §2.10 rule 46. All domain exceptions inherit from this. |
| Create | `src/YtGuessWho.Domain/Exceptions/JamNotJoinableException.cs` | Thrown by `Jam.AddPlayer` when the Jam is not in `Lobby` phase. Inherits `DomainException`. Constructor accepts the current `JamPhase` so the message is descriptive. |
| Modify | `src/YtGuessWho.Domain/Aggregates/Jam.cs` | Add `AddPlayer(string connectionId, string displayName)` method. Enforces the invariant: throws `JamNotJoinableException` if `Phase != JamPhase.Lobby`. Creates a new `Player` with `isHost: false` and appends to `_players`. Validates both parameters are non-null with `ArgumentNullException.ThrowIfNull`. |

#### Application — `YtGuessWho.Application`

| Action | File | Notes |
|--------|------|-------|
| Create | `src/YtGuessWho.Application/Commands/JoinJamCommand.cs` | Immutable record holding `ConnectionId` (string), `JamCode` (string), and `DisplayName` (string). |
| Create | `src/YtGuessWho.Application/Exceptions/JamNotFoundException.cs` | Thrown by `JamService` when `IJamRepository.FindByCode` returns `null`. Inherits from `Exception` — this is a lookup concern at the application boundary, not a domain invariant. |
| Modify | `src/YtGuessWho.Application/Services/IJamService.cs` | Add `Task JoinJam(JoinJamCommand command, CancellationToken cancellationToken = default)`. Document the three exceptions it may throw. |
| Modify | `src/YtGuessWho.Application/Services/Implementations/JamService.cs` | Implement `JoinJam`. Flow: (1) call `_repository.FindByPlayerId(command.ConnectionId)` — throw `PlayerAlreadyInJamException` if found; (2) call `_repository.FindByCode(command.JamCode)` — throw `JamNotFoundException` if null; (3) call `jam.AddPlayer(command.ConnectionId, command.DisplayName)` — `JamNotJoinableException` propagates naturally from the domain. Log at `Information` level on success. |

#### Infrastructure — `YtGuessWho.Infrastructure`

| Action | File | Notes |
|--------|------|-------|
| Modify | `src/YtGuessWho.Infrastructure/Hubs/GameHub.cs` | Add `JoinJam(string jamCode, string displayName): Task` hub method. Flow: (1) call `_jamService.JoinJam(new JoinJamCommand(Context.ConnectionId, jamCode, displayName), Context.ConnectionAborted)`; (2) on success, add caller to the SignalR group keyed by `jamCode`. Error handling: catch each of the three exceptions (`PlayerAlreadyInJamException`, `JamNotFoundException`, `JamNotJoinableException`), send `Clients.Caller.Error(...)` with the appropriate error code, then throw a `HubException` with the same error code string. The `HubException` causes the client's `invoke()` Promise to reject, which is how the component surfaces the error — the `Error` event is also sent to satisfy the architectural contract for a future global listener. Log `Warning` for each error case. |

#### Tests — `YtGuessWho.Tests`

| Action | File | Notes |
|--------|------|-------|
| Modify | `tests/YtGuessWho.Tests/Domain/JamTests.cs` | Add tests for `Jam.AddPlayer`. Cover: player is added to the Players list; `IsHost` is `false`; `Score` is `0`; `PlayerId` equals the provided `connectionId`; `DisplayName` matches; throws `JamNotJoinableException` when Phase is not `Lobby`; throws `ArgumentNullException` for null `connectionId`; throws `ArgumentNullException` for null `displayName`. Set a non-Lobby phase by using a test helper or a second `AddPlayer` call is insufficient — consider setting Phase via reflection or adding a package-internal test setter. As a pragmatic alternative, test only the happy path (Lobby phase) and the `JamNotJoinableException` guard; the phase mutation needed for the latter may be deferred to when `AdvancePhase` is implemented. |
| Create | `tests/YtGuessWho.Tests/Application/JamServiceJoinJamTests.cs` | Unit tests for `JamService.JoinJam`. Cover: happy path calls `_repository.FindByCode` and `jam.AddPlayer`; `PlayerAlreadyInJamException` thrown when `FindByPlayerId` returns a Jam; `JamNotFoundException` thrown when `FindByCode` returns null; `JamNotJoinableException` propagates from the domain (use a Jam fake/spy in a non-Lobby state if possible, otherwise mock `Jam.AddPlayer` — note the aggregate is a concrete class, so the test may call a real `Jam` instance and verify the exception propagates). |

#### Client — `client/`

| Action | File | Notes |
|--------|------|-------|
| Modify | `client/src/app/core/hub-connection.service.ts` | Add `joinJam(jamCode: string, displayName: string): Promise<void>` method. Internally calls `this.#connection.invoke<void>('JoinJam', jamCode, displayName)`. Thin delegation only — no state management. |
| Modify | `client/src/app/core/hub-connection.service.spec.ts` | Add tests for `joinJam`: calls `invoke` with the correct method name and both arguments in order; resolves when `invoke` resolves; propagates a rejected promise when `invoke` rejects. |
| Modify | `client/src/app/lobby/lobby.component.ts` | Overhaul the template and component logic to support both flows. Add signals: `jamCode` input signal renamed to `enteredJamCode` (writable `string` signal, default `''`) to hold the user-typed join code; `isJoining` (writable `boolean` signal, default `false`). The existing `jamCode` result signal (currently `string | null`) remains for showing the confirmed code after either action. Template changes: add a Jam code text input (always visible, used by the Join flow); add a **Join Jam** button alongside the existing **Create Jam** button. **Join Jam** disabled when: `!enteredJamCode().trim()`, `!displayName().trim()`, `isJoining()`, or `hubService.isTransitioning()`. Add `onJoinJam()` method mirroring `onCreateJam()`: connect first if not connected (same pattern); set `isJoining = true`; call `hubService.joinJam(enteredJamCode().trim(), displayName().trim())`; on resolve set `jamCode` to `enteredJamCode().trim()` and clear `errorMessage`; on reject set `errorMessage`; always set `isJoining = false` in `finally`. The success view already exists — it shows whatever is in `jamCode()`. |
| Modify | `client/src/app/lobby/lobby.component.scss` | Add styles for the two-button row (e.g. `display: flex; gap: 0.75rem`). The existing `.jam-created` styles need no changes. |
| Modify | `client/src/app/lobby/lobby.component.spec.ts` | Add tests for the Join Jam flow. Cover: **Join Jam** button disabled when Jam code is empty; **Join Jam** button disabled when display name is empty; **Join Jam** button disabled while `isJoining` is true; button click calls `joinJam` with trimmed jam code and display name; Jam code is rendered after a successful join; error message is rendered when `joinJam` rejects. |

### Key design constraints

**`HubException` causes Promise rejection.** The `GameHub.JoinJam` method must throw a `HubException` after sending the `Error` event for each failure case. This is the mechanism that causes the Angular client's `invoke()` Promise to reject, which the component handles in its `catch` block. This is consistent with how errors are surfaced client-side (no global Error listener yet — that is deferred per ticket-005 design constraints). The `Error` event is still sent so the architectural contract is maintained for a future global handler.

**`PlayerJoined` is not broadcast.** Per the out-of-scope definition, existing Jam members are not notified when a new Player joins. The caller is added to the SignalR group (so future broadcasts reach them), but no event is sent to the group. This will be addressed in a later ticket.

**Group add on success only.** `Groups.AddToGroupAsync` is called only after `_jamService.JoinJam` succeeds. If the service throws, the caller must not be added to the group.

**`HubException` message = error code string.** The `HubException` constructor receives the machine-readable error code (e.g. `"JAM_NOT_FOUND"`) as its message. The Angular client's rejected Promise carries this string, allowing the component to display a meaningful message.

**`enteredJamCode` vs `jamCode`.** The component holds two conceptually different jam codes: `enteredJamCode` is the raw user input for the join flow; `jamCode` is the confirmed code shown after a successful create or join. The naming must remain unambiguous.

**`DomainException` base class is new.** This ticket introduces it for `JamNotJoinableException`. The existing `PlayerAlreadyInJamException` remains in Application as-is (it is not a single-aggregate invariant — it requires a cross-aggregate repository lookup). Do not refactor it in this ticket.

### Out of scope

- Broadcasting `PlayerJoined` to existing Jam members when a new Player joins.
- Displaying the Player list inside the Lobby.
- `AdvancePhase` — needed to manually test the `JAM_NOT_JOINABLE` scenario but belongs to a later ticket.
- Reconnection handling or restoring Jam association after a disconnect.
- Any navigation or routing beyond the current single-page lobby view.

---

## Test Plan

> **For the human tester only.**
> Manual verification steps to execute after the Dev has finished, with both the server and the Angular dev server running.

### Tooling

- Server running via `dotnet run` from `server/src/YtGuessWho.Api/` (default port `5030`).
- Angular dev server running via `pnpm start` from `client/` (`http://localhost:4200`).
- Two separate browser tabs open at `http://localhost:4200` — **Tab A** (Host) and **Tab B** (Joiner).
- Browser DevTools → **Console** tab visible in each tab.
- Server terminal visible to inspect structured log output.

### Preconditions

- Server is running and `GET /health` returns `200 OK`.
- Angular dev server is running and both tabs load without console errors.

---

### Scenario 1 — Happy Path: Join an Existing Jam

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | In **Tab A**, type `Alice` and click **Create Jam** | Jam code (e.g. `WKPGRT`) is shown prominently |
| 2 | Note the Jam code displayed in Tab A | — |
| 3 | In **Tab B**, type `Bob` in the display name input | — |
| 4 | In **Tab B**, type the noted Jam code into the Jam code input | — |
| 5 | In **Tab B**, observe the **Join Jam** button | Button is enabled |
| 6 | In **Tab B**, click **Join Jam** | Button becomes disabled immediately |
| 7 | Wait for the server to respond | The Jam code is displayed prominently in Tab B |
| 8 | Inspect the server terminal logs | A log entry confirms the Player joined, showing the JamCode and the ConnectionId |

---

### Scenario 2 — Join Jam Blocked When Display Name Is Empty

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | In any tab, leave the display name input empty | — |
| 2 | Type any text in the Jam code input | — |
| 3 | Observe the **Join Jam** button | Button is disabled |

---

### Scenario 3 — Join Jam Blocked When Jam Code Is Empty

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | In any tab, type a display name | — |
| 2 | Leave the Jam code input empty | — |
| 3 | Observe the **Join Jam** button | Button is disabled |

---

### Scenario 4 — JAM_NOT_FOUND Error

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | In any tab, type `Bob` in the display name input | — |
| 2 | Type `ZZZZZZ` (a code that does not match any existing Jam) | — |
| 3 | Click **Join Jam** | Button becomes disabled briefly |
| 4 | Wait for the response | An error message is displayed on screen referencing the failed join |
| 5 | Inspect the server terminal logs | A `Warning`-level log entry records the `JAM_NOT_FOUND` rejection |

---

### Scenario 5 — ALREADY_IN_JAM Error

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | In **Tab A**, create a Jam as Alice — note the code | Jam code shown in Tab A |
| 2 | In **Tab B**, join the Jam as Bob (Scenario 1) | Jam code shown in Tab B |
| 3 | In **Tab B**, open DevTools Console and run: `ng.getComponent(document.querySelector('app-lobby')).onJoinJam()` — or type another code and click **Join Jam** again | — |
| 4 | Observe the UI in Tab B | An error message is displayed indicating the player is already in a Jam |
| 5 | Inspect the server terminal logs | A `Warning`-level log entry records the `ALREADY_IN_JAM` rejection; no duplicate Player is added |

---

### Scenario 6 — In-Flight Button Disabled (No Double Submission)

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | In **Tab A**, create a Jam and note the code | Jam code shown |
| 2 | In **Tab B**, enter a display name and the Jam code | **Join Jam** button is enabled |
| 3 | Using DevTools, throttle the network to **Slow 3G** | — |
| 4 | Click **Join Jam** | Button becomes disabled immediately |
| 5 | While the request is in flight, attempt to click the disabled button | Nothing happens |
| 6 | Wait for the response | Jam code shown; button returns to enabled state |
| 7 | Remove the network throttle | — |

