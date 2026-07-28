# TICKET-005: Create a Jam

## User Story

As a Host,
I want to enter my display name and create a new Jam with a single button click,
So that I receive a short, friendly Jam code I can share with other Players to invite them.

---

## Acceptance Criteria

- **Given** the application is connected to the hub,
  **When** the Host enters a display name and clicks **Create Jam**,
  **Then** the server creates the Jam in memory, the Host is recorded as the sole Player with `IsHost = true`, and the Jam code is returned to the client and displayed prominently on screen.

- **Given** the application is connected to the hub,
  **When** the Host clicks **Create Jam** with an empty display name,
  **Then** the **Create Jam** button is disabled and no hub invocation is made.

- **Given** the application has not yet connected to the hub (connection status is Disconnected),
  **When** the lobby is rendered,
  **Then** the **Create Jam** button is disabled and cannot be clicked.

- **Given** the Host has clicked **Create Jam** and the request is in-flight,
  **When** the server has not yet responded,
  **Then** the **Create Jam** button is disabled for the entire duration of the request — no double-submission is possible.

- **Given** the Host has already created a Jam (and is therefore already in a Jam),
  **When** a second `CreateJam` hub method call is made for the same connection,
  **Then** the server sends an `Error` event to the caller with code `ALREADY_IN_JAM` and does not create a second Jam.

- **Given** a Jam is created,
  **When** the server persists it,
  **Then** the stored Jam has: the generated code as its identity, `Phase = Lobby`, and a Players list containing exactly one entry representing the Host — with the caller's `ConnectionId` as `PlayerId`, the provided `displayName`, `IsHost = true`, and `Score = 0`.

---

## Technical Notes

### Architecture placement

This ticket spans all four server layers plus the client. Layer responsibilities are defined in
`docs/solution-architecture.md#layer-responsibilities`. The SignalR hub design constraints are
in `docs/realtime-communication.md#hub-design`.

### Files to create or modify

#### Domain — `YtGuessWho.Domain`

| Action | File | Notes |
|--------|------|-------|
| Create | `src/YtGuessWho.Domain/Enums/JamPhase.cs` | Enum with four values: `Lobby`, `Submission`, `Playback`, `Results`. Only `Lobby` is exercised in this ticket; all four must be declared now as they are part of the domain model. |
| Create | `src/YtGuessWho.Domain/ValueObjects/JamCode.cs` | Immutable value object wrapping a 6-character uppercase alphabetic string (excluding visually ambiguous characters such as `I` and `O`). Must expose a static `Generate()` factory that produces a new random code using `System.Random.Shared`. Must validate that a supplied string matches the expected format and throw on invalid input. |
| Create | `src/YtGuessWho.Domain/Entities/Player.cs` | Entity holding `PlayerId` (string), `DisplayName` (string), `IsHost` (bool), `Score` (int, default 0), and `Submission` (string?, default null — typed as string for now; will be replaced by a `YoutubeUrl` value object in a later ticket). |
| Create | `src/YtGuessWho.Domain/Aggregates/Jam.cs` | Aggregate root. Fields match the domain model in `docs/context.md#domain-model` exactly. Must expose a static `CreateNew(string connectionId, string displayName)` factory that: generates a `JamCode`, initialises `Phase = Lobby`, and creates the Host `Player`. The returned Jam has a single Player in its Players list. All other aggregate methods (`AdvancePhase`, `SubmitSong`, etc.) are out of scope for this ticket — do not add stub or `NotImplementedException` methods. |

#### Application — `YtGuessWho.Application`

| Action | File | Notes |
|--------|------|-------|
| Create | `src/YtGuessWho.Application/Repositories/IJamRepository.cs` | Interface with three methods: `Add(Jam jam)`, `Jam? FindByCode(string code)`, and `Jam? FindByPlayerId(string playerId)`. The last method is required to detect the `ALREADY_IN_JAM` precondition. |
| Create | `src/YtGuessWho.Application/Commands/CreateJamCommand.cs` | Immutable record holding `ConnectionId` (string) and `DisplayName` (string). |
| Create | `src/YtGuessWho.Application/Exceptions/PlayerAlreadyInJamException.cs` | Application exception thrown by `JamService` when `IJamRepository.FindByPlayerId` returns a non-null Jam for the requesting connection. |
| Create | `src/YtGuessWho.Application/Services/IJamService.cs` | Interface declaring `Task<string> CreateJam(CreateJamCommand command)`. Returns the `JamCode` value as a string. |
| Create | `src/YtGuessWho.Application/Services/Implementations/JamService.cs` | Implements `IJamService`. `CreateJam` flow: (1) call `_repository.FindByPlayerId(command.ConnectionId)` — throw `PlayerAlreadyInJamException` if a Jam is found; (2) call `Jam.CreateNew(command.ConnectionId, command.DisplayName)`; (3) call `_repository.Add(jam)`; (4) return the `JamCode` string. |
| Modify | `src/YtGuessWho.Application/DependencyInjection/ApplicationModule.cs` | Register `JamService` as `IJamService` with `InstancePerLifetimeScope()`. |

#### Infrastructure — `YtGuessWho.Infrastructure`

| Action | File | Notes |
|--------|------|-------|
| Create | `src/YtGuessWho.Infrastructure/Repositories/InMemoryJamRepository.cs` | Implements `IJamRepository`. Uses `ConcurrentDictionary<string, Jam>` keyed by `JamCode`. Thread-safety requirement is noted in `docs/solution-architecture.md#cross-cutting-concerns`. `FindByPlayerId` scans the dictionary values for a Jam whose `Players` list contains a Player with the given `PlayerId`. Register as `SingleInstance()` so the same dictionary survives the full process lifetime. |
| Modify | `src/YtGuessWho.Infrastructure/Hubs/GameHub.cs` | Inject `IJamService` via the constructor. Add the `CreateJam(string displayName)` hub method. Method flow: (1) call `_jamService.CreateJam(new CreateJamCommand(Context.ConnectionId, displayName))`; (2) add the caller to the SignalR group keyed by the returned JamCode (`Groups.AddToGroupAsync`); (3) send `PlayerJoined` to the group with the Host's details; (4) return the JamCode string to the caller. Catch `PlayerAlreadyInJamException` and respond with `Clients.Caller.Error(new ErrorPayload("ALREADY_IN_JAM", "..."))` — do not propagate the exception further. |
| Modify | `src/YtGuessWho.Infrastructure/DependencyInjection/InfrastructureModule.cs` | Register `InMemoryJamRepository` as `IJamRepository` with `SingleInstance()`. |

#### Tests — `YtGuessWho.Tests`

| Action | File | Notes |
|--------|------|-------|
| Create | `tests/YtGuessWho.Tests/Domain/JamTests.cs` | Unit tests for `Jam.CreateNew` and `JamCode`. Cover: Host is added as the sole Player; `IsHost = true`; `Phase = Lobby`; `Score = 0`; `JamCode` format is valid (6 uppercase non-ambiguous chars); `JamCode` constructor rejects invalid formats. |
| Create | `tests/YtGuessWho.Tests/Application/JamServiceTests.cs` | Unit tests for `JamService.CreateJam`. Cover: happy path returns a non-empty JamCode string and calls `_repository.Add`; calling with an already-in-Jam `ConnectionId` (mock `FindByPlayerId` returns a Jam) throws `PlayerAlreadyInJamException`. Use a mock/fake `IJamRepository` — no real `ConcurrentDictionary`. |

#### Client — `client/`

| Action | File | Notes |
|--------|------|-------|
| Modify | `client/src/app/core/hub-connection.service.ts` | Add `createJam(displayName: string): Promise<string>` method. Internally calls `this.#connection.invoke<string>('CreateJam', displayName)`. No state mutation inside the service beyond what already exists — the method is a thin delegation to the underlying connection. |
| Modify | `client/src/app/core/hub-connection.service.spec.ts` | Add tests covering: `createJam` calls `invoke` with the correct method name and argument; `createJam` returns the resolved JamCode string; `createJam` propagates a rejected promise when `invoke` rejects. |
| Create | `client/src/app/lobby/lobby.component.ts` | Standalone, `OnPush`, selector `app-lobby`. Inject `HubConnectionService`. Internal signals: `displayName` (writable string signal, default `''`), `jamCode` (writable `string | null` signal, default `null`), `isCreating` (writable bool signal, default `false`), `errorMessage` (writable `string | undefined` signal). The **Create Jam** button is disabled when any of: `!isConnected()`, `!displayName().trim()`, or `isCreating()`. On button click: set `isCreating = true`; call `hubConnectionService.createJam(displayName())`; on resolve set `jamCode` to the result and clear `errorMessage`; on reject set `errorMessage` from the caught error; always set `isCreating = false` in the finally block. When `jamCode()` is non-null, hide the form and display the Jam code prominently (see styling note below). |
| Create | `client/src/app/lobby/lobby.component.scss` | When `jamCode` is set, the code must be displayed using a large font size (at minimum `4rem`), centred horizontally, with generous vertical spacing so it is immediately readable across the screen. Use letter-spacing to separate the characters visually. |
| Create | `client/src/app/lobby/lobby.component.spec.ts` | Unit tests covering: button is disabled when not connected; button is disabled when display name is empty; button is disabled while `isCreating` is true; button click calls `createJam` with the trimmed display name; Jam code is rendered when `jamCode` is non-null; error message is rendered when `errorMessage` is non-undefined. |
| Modify | `client/src/app/app.ts` | Import and include `LobbyComponent` in the root component template, placed after `ConnectionStatusComponent`. |

### NuGet packages

No new NuGet packages are required. All types used are within `YtGuessWho.*` projects or the
`Microsoft.AspNetCore.App` shared framework already referenced.

### Key design constraints

**`CreateJam` returns the JamCode to the caller.** The hub method must return the JamCode string as its
return value (i.e. `Task<string>`) so the Angular client's `invoke<string>('CreateJam', displayName)`
promise resolves with the code directly. Do not rely solely on a server-pushed event to convey the code,
as the `PlayerJoined` payload defined in `docs/realtime-communication.md#server--client-event-reference`
does not carry the JamCode.

**`PlayerJoined` must still be broadcast.** Even though the Host is the only group member at this stage,
`PlayerJoined` must be sent to the group after `CreateJam` succeeds. The established message-flow
contract in `docs/realtime-communication.md#lobby` requires it, and later tickets (JoinJam) depend
on that event arriving for all participants including the Host.

**`ConnectionId` = `PlayerId`.** Per `docs/realtime-communication.md#rules-for-implementors`, rule 6:
the SignalR `ConnectionId` is the Player's identity. `Jam.CreateNew` receives `connectionId` and stores it
as `Player.PlayerId` directly — no separate ID generation is permitted.

**Group key = JamCode.** Per `docs/realtime-communication.md#rules-for-implementors`, rule 4: the
SignalR group name is always the Jam's `JamCode` string.

**`ALREADY_IN_JAM` is caught in the Hub, not rethrown.** The Hub must catch `PlayerAlreadyInJamException`,
send `Clients.Caller.Error(...)` with code `ALREADY_IN_JAM`, and return gracefully. The client must
never receive an unhandled hub exception for this case.

**`JamCode.Generate()` does not guarantee global uniqueness.** For V1 collision probability is
negligible (26^6 ≈ 309 million combinations). No uniqueness retry loop is required in this ticket.

**`createJam` on `HubConnectionService` is a thin delegation.** It must not encode any lobby-level
state or UI logic. State management (isCreating, jamCode, errorMessage) lives entirely in
`LobbyComponent`.

**No `Error` event listener on the client in this ticket.** The `LobbyComponent` reads the error
from the rejected `createJam()` Promise. Registering a global `on('Error', ...)` handler in
`HubConnectionService` is deferred to a later ticket.

### Out of scope

- The `JoinJam` hub method and any client-side join flow.
- Displaying the Player list inside the Jam (Lobby player roster).
- The `YoutubeUrl` value object and `Player.Submission` typed as `YoutubeUrl`.
- JamCode uniqueness guarantee / collision retry.
- Persisting Jam state across server restarts.
- Automatic reconnection after a disconnect while in a Jam.
- Host disconnection handling (`OnDisconnectedAsync` Jam cleanup).
- A global `Error` event listener in `HubConnectionService`.
- Navigation or routing between lobby and in-game views.

---

## Test Plan

> **For the human tester only.**
> Manual verification steps to execute after the Dev has finished, with both the server and the Angular dev server running.

### Tooling

- Server running via `dotnet run` from `server/src/YtGuessWho.Api/` (default port `5030`).
- Angular dev server running via `pnpm start` from `client/` (`http://localhost:4200`).
- Browser open at `http://localhost:4200` with DevTools → **Console** and **Network → WS** tabs visible.
- Server terminal visible to inspect structured log output.

### Preconditions

- Server is running and `GET /health` returns `200 OK`.
- Angular dev server is running and the page loads without console errors.
- No prior WebSocket connections are open (fresh page load or hard refresh).

---

### Scenario 1 — Happy Path: Create a Jam Successfully

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Load `http://localhost:4200` in the browser | Page renders without console errors; the `ConnectionStatusComponent` shows **Disconnected** |
| 2 | Click **Connect** (from ticket-004's component) | Status transitions to **Connected** |
| 3 | Observe the **Create Jam** form | A display name text input and a **Create Jam** button are visible |
| 4 | Leave the display name input empty and observe the button | **Create Jam** button is disabled |
| 5 | Type `Alice` into the display name input | **Create Jam** button becomes enabled |
| 6 | Click **Create Jam** | Button becomes disabled immediately |
| 7 | Wait for the server to respond (< 1 second on localhost) | The form disappears and a Jam code is displayed prominently on screen |
| 8 | Inspect the displayed Jam code | It is exactly 6 uppercase alphabetic characters (e.g. `WKPGRT`) |
| 9 | Inspect the server terminal logs | A structured log entry confirms the Jam was created, showing the JamCode and the ConnectionId |

---

### Scenario 2 — Create Jam Blocked When Disconnected

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Load (or hard-refresh) `http://localhost:4200` — do **not** click Connect | Status shows **Disconnected** |
| 2 | Type `Alice` into the display name input | Text is accepted |
| 3 | Observe the **Create Jam** button | Button is disabled — it cannot be clicked |
| 4 | Open DevTools → Network → WS | No WebSocket traffic is initiated |

---

### Scenario 3 — Create Jam Blocked When Display Name Is Empty

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Connect (Scenario 1, steps 1–2) | Status shows **Connected** |
| 2 | Leave the display name input empty | — |
| 3 | Observe the **Create Jam** button | Button is disabled |
| 4 | Type a single space into the input and observe the button | Button remains disabled (whitespace-only names are treated as empty) |
| 5 | Type `B` (a non-whitespace character) and observe the button | Button becomes enabled |

---

### Scenario 4 — ALREADY_IN_JAM Error

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Complete Scenario 1 fully — a Jam code is displayed on screen | Jam code (e.g. `WKPGRT`) is shown prominently |
| 2 | Open DevTools → **Console** tab | — |
| 3 | In the console, run: `ng.getComponent(document.querySelector('app-root')).hubConnectionService.createJam('Alice')` (or equivalent to invoke the hub method a second time on the same connection) | The promise rejects or the UI displays an error message |
| 4 | Observe the UI or console output | An error referencing `ALREADY_IN_JAM` is visible — either in the UI as an error message or in the console as the rejected promise reason |
| 5 | Inspect the server terminal logs | A warning-level log entry records the `ALREADY_IN_JAM` rejection for the ConnectionId; no second Jam is created |

---

### Scenario 5 — In-Flight Button Disabled (No Double Submission)

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Connect and type a display name (Scenario 1, steps 1–5) | **Create Jam** button is enabled |
| 2 | Using DevTools, throttle the network to **Slow 3G** to simulate latency | — |
| 3 | Click **Create Jam** | Button becomes disabled immediately |
| 4 | While the request is still in flight, attempt to click the disabled button again | Nothing happens — the button cannot be activated |
| 5 | Wait for the response to arrive | Jam code is displayed; button state is resolved |
| 6 | Remove the network throttle | — |

