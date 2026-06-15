# TICKET-008: Leave Jam

## User Story

As a Player in a Jam,
I want to explicitly leave the Jam at any time,
So that the remaining Players are informed of my departure and, if I was the Host, a new Host is immediately assigned.

---

## Acceptance Criteria

- **Given** a Player is in a Jam with at least one other Player,
  **When** the Player clicks **Leave Jam**,
  **Then** the server removes them from the Jam, broadcasts `PlayerLeft { playerId }` to all remaining Players, and the leaving Player's UI resets to the initial lobby form.

- **Given** the Host is in a Jam with at least one other Player,
  **When** the Host clicks **Leave Jam**,
  **Then** a random remaining Player is promoted to Host; the server broadcasts `PlayerLeft` followed by `HostChanged { newHostPlayerId }` to all remaining Players; their UIs update the Host indicator accordingly.

- **Given** a Player is the sole member of a Jam,
  **When** they click **Leave Jam**,
  **Then** the Jam is removed from the repository, no broadcast is made, and the Player's UI resets to the initial lobby form.

- **Given** a connected Player who is not currently in any Jam,
  **When** the `LeaveJam` hub method is invoked,
  **Then** the server sends `Error { code: "NOT_IN_JAM" }` to the caller and the client displays an error message.

- **Given** a Player is in a Jam and clicks **Leave Jam**,
  **When** the request is in flight,
  **Then** the **Leave Jam** button is disabled until the request completes — no double-submission is possible.

- **Given** a Player is in a Jam with other Players,
  **When** the Player's connection is lost abruptly (browser closed, network drop),
  **Then** `OnDisconnectedAsync` triggers the same removal and broadcast logic as an explicit `LeaveJam` call — remaining Players receive `PlayerLeft` and, if applicable, `HostChanged`.

- **Given** a Player is viewing the Jam lobby,
  **When** a `PlayerLeft` event is received,
  **Then** the corresponding Player is removed from the displayed Players list.

- **Given** a Player is viewing the Jam lobby,
  **When** a `HostChanged` event is received,
  **Then** the Players list is updated so that exactly one Player — the one with `newHostPlayerId` — shows the Host indicator, and all others do not.

---

## Technical Notes

### Architecture placement

This ticket spans all four server layers plus the Angular client. Layer responsibilities are defined in `docs/solution-architecture.md#layer-responsibilities`. The `OnDisconnectedAsync` obligation and the `PlayerLeft` broadcast contract are specified in `docs/realtime-communication.md#connection-lifecycle`. The `NOT_IN_JAM` error code is defined in `docs/realtime-communication.md#error-code-reference`.

### Files to create or modify

#### Domain — `YtGuessWho.Domain`

| Action | File | Notes |
|--------|------|-------|
| Modify | `src/YtGuessWho.Domain/Aggregates/Jam.cs` | Add `RemovePlayer(string connectionId)`. Validates `connectionId` is non-null with `ArgumentNullException.ThrowIfNull`. Finds and removes the matching Player from `_players`. If the removed Player had `IsHost = true` AND `_players` is non-empty after removal, randomly selects one remaining Player and sets their `IsHost = true` (all others remain `false`). Does not interact with the repository — Jam disposal is the Application layer's responsibility. |

#### Application — `YtGuessWho.Application`

| Action | File | Notes |
|--------|------|-------|
| Create | `src/YtGuessWho.Application/Commands/LeaveJamCommand.cs` | Immutable record with a single property: `ConnectionId (string)`. |
| Create | `src/YtGuessWho.Application/DTOs/LeaveJamResult.cs` | Immutable record: `JamCode (string)`, `JamIsEmpty (bool)`, `NewHostPlayerId (string?)`. Carries the outcome of a leave operation back to the Hub. `NewHostPlayerId` is non-null only when the departing Player was the Host and at least one Player remains. |
| Create | `src/YtGuessWho.Application/Exceptions/NotInJamException.cs` | Thrown by `JamService.LeaveJam` when `FindByPlayerId` returns null. Inherits from `Exception`. Maps to the `NOT_IN_JAM` error code. |
| Modify | `src/YtGuessWho.Application/Repositories/IJamRepository.cs` | Add `void Remove(string jamCode)`. Removes the Jam identified by `jamCode` from the store. No-op if not found. |
| Modify | `src/YtGuessWho.Infrastructure/Repositories/InMemoryJamRepository.cs` | Implement `Remove(string jamCode)` by deleting the entry from `_jams`. |
| Modify | `src/YtGuessWho.Application/Services/IJamService.cs` | Add `Task<LeaveJamResult> LeaveJam(LeaveJamCommand command, CancellationToken cancellationToken = default)`. Document that it throws `NotInJamException` when the player is not associated with any active Jam. |
| Modify | `src/YtGuessWho.Application/Services/Implementations/JamService.cs` | Implement `LeaveJam`. Flow: (1) call `_repository.FindByPlayerId(command.ConnectionId)` — throw `NotInJamException` if null; (2) note the pre-removal Host ID: `var previousHostId = jam.Players.FirstOrDefault(p => p.IsHost)?.PlayerId`; (3) call `jam.RemovePlayer(command.ConnectionId)`; (4) if `jam.Players` is empty, call `_repository.Remove(jam.JamCode.Value)` and return `new LeaveJamResult(jam.JamCode.Value, true, null)`; (5) otherwise, find the new host: `var newHostId = jam.Players.FirstOrDefault(p => p.IsHost)?.PlayerId`; (6) return `new LeaveJamResult(jam.JamCode.Value, false, previousHostId == command.ConnectionId ? newHostId : null)`. Log at `Information` level on success, including `JamCode`, `ConnectionId`, whether the Jam was disposed, and the new Host ID if reassigned. |

#### Infrastructure — `YtGuessWho.Infrastructure`

| Action | File | Notes |
|--------|------|-------|
| Create | `src/YtGuessWho.Infrastructure/Hubs/Payloads/PlayerLeftPayload.cs` | Immutable record: `PlayerId (string)`. Wire-level DTO for the `PlayerLeft` event. |
| Create | `src/YtGuessWho.Infrastructure/Hubs/Payloads/HostChangedPayload.cs` | Immutable record: `NewHostPlayerId (string)`. Wire-level DTO for the new `HostChanged` event introduced by this ticket. |
| Modify | `src/YtGuessWho.Infrastructure/Hubs/IGameHubClient.cs` | Add `Task PlayerLeft(PlayerLeftPayload payload)`. Add `Task HostChanged(HostChangedPayload payload)`. `PlayerLeft` was already reserved in the Architect contract (`docs/realtime-communication.md#igamehubclient`). `HostChanged` is a new event introduced here. |
| Modify | `src/YtGuessWho.Infrastructure/Hubs/GameHub.cs` | **`LeaveJam()` hub method:** (1) call `_jamService.LeaveJam(new LeaveJamCommand(Context.ConnectionId), Context.ConnectionAborted)`; (2) call `Groups.RemoveFromGroupAsync(Context.ConnectionId, result.JamCode)` so the leaving Player does not receive its own departure broadcast; (3) if `!result.JamIsEmpty`, send `Clients.Group(result.JamCode).PlayerLeft(new PlayerLeftPayload(Context.ConnectionId))`; (4) if `result.NewHostPlayerId != null`, send `Clients.Group(result.JamCode).HostChanged(new HostChangedPayload(result.NewHostPlayerId))`. Error handling: catch `NotInJamException`, send `Clients.Caller.Error(...)` with code `NOT_IN_JAM`, then throw `HubException("NOT_IN_JAM")`. Log `Warning` on error. **`OnDisconnectedAsync(Exception? exception)`:** wrap the entire leave logic in try-catch; call `_jamService.LeaveJam(new LeaveJamCommand(Context.ConnectionId))` (no `CancellationToken` — connection is already closing); if `NotInJamException` is caught, log at `Debug` level and proceed (player never joined a Jam — this is normal); on success, do NOT call `Groups.RemoveFromGroupAsync` (SignalR handles group cleanup automatically on disconnect); if `!result.JamIsEmpty`, broadcast `PlayerLeft` and, if applicable, `HostChanged` using the same group broadcast calls as the hub method. Always call `await base.OnDisconnectedAsync(exception)` at the end, regardless of outcome. |

#### Tests — `YtGuessWho.Tests`

| Action | File | Notes |
|--------|------|-------|
| Modify | `tests/YtGuessWho.Tests/Domain/JamTests.cs` | Add tests for `Jam.RemovePlayer`. Cover: a non-Host Player is removed and the Players count decrements; a non-Host Player is removed and `IsHost` of the remaining Players is unchanged; the Host Player is removed when others remain — exactly one remaining Player has `IsHost = true`; when the last Player is removed the list is empty; throws `ArgumentNullException` for null `connectionId`. |
| Create | `tests/YtGuessWho.Tests/Application/JamServiceLeaveJamTests.cs` | Unit tests for `JamService.LeaveJam`. Cover: happy path — returns `LeaveJamResult` with correct `JamCode` and `JamIsEmpty = false`; `NewHostPlayerId` is non-null when the departing Player was the Host and others remain; `NewHostPlayerId` is null when a non-Host Player leaves; when the last Player leaves, `JamIsEmpty = true` and `_repository.Remove` is called; `NotInJamException` is thrown when `FindByPlayerId` returns null. |

#### Client — `client/`

| Action | File | Notes |
|--------|------|-------|
| Create | `client/src/app/core/models/host-changed.model.ts` | TypeScript interface `HostChangedEvent` with `newHostPlayerId: string`. |
| Modify | `client/src/app/core/hub-connection.service.ts` | Add `leaveJam(): Promise<void>` — delegates to `this.#connection.invoke<void>('LeaveJam')`. Add `onPlayerLeft(handler: (payload: { playerId: string }) => void): void` — delegates to `this.#connection.on('PlayerLeft', handler)`. Add `onHostChanged(handler: (payload: HostChangedEvent) => void): void` — delegates to `this.#connection.on('HostChanged', handler)`. Thin delegation only. |
| Modify | `client/src/app/core/hub-connection.service.spec.ts` | Add tests: `leaveJam` invokes with method name `'LeaveJam'`; `onPlayerLeft` registers event name `'PlayerLeft'` and handler; `onHostChanged` registers event name `'HostChanged'` and handler. |
| Modify | `client/src/app/lobby/lobby.component.ts` | Add `isLeaving` writable boolean signal (default `false`). In the constructor, register `hubService.onPlayerLeft(payload => this.players.update(list => list.filter(p => p.playerId !== payload.playerId)))`. Register `hubService.onHostChanged(payload => this.players.update(list => list.map(p => ({ ...p, isHost: p.playerId === payload.newHostPlayerId }))))`. Add `onLeaveJam()` method: set `isLeaving = true`; call `hubService.leaveJam()`; on resolve: set `jamCode` to null, reset `players` to `[]`, clear `errorMessage`; on reject: set `errorMessage`; always set `isLeaving = false` in `finally`. In the success view template (when `jamCode()` is non-null), add a **Leave Jam** button disabled when `isLeaving()` is true, bound to `onLeaveJam()`. |
| Modify | `client/src/app/lobby/lobby.component.spec.ts` | Add tests: **Leave Jam** button visible when `jamCode` is non-null; disabled when `isLeaving` is true; clicking it calls `hubService.leaveJam()`; on success, `jamCode` is null and `players` is empty; on error, `errorMessage` is set; a `PlayerLeft` event removes the matching Player from the list; a `HostChanged` event sets `isHost = true` only for the new Host and `isHost = false` for all others. |
| Modify | `client/src/app/lobby/lobby.component.scss` | Ensure the **Leave Jam** button has appropriate placement within the success view, consistent with the spacing conventions established in the existing styles. |

### NuGet packages

None — no new server-side packages required.

### Key design constraints

**`HostChanged` is a new event not yet in the Architect docs.** It must be added to `IGameHubClient` before the Hub logic is written. The payload carries only `newHostPlayerId` — the client is responsible for updating all other Players' `isHost` flags to `false`.

**Group removal order in the `LeaveJam` hub method.** `Groups.RemoveFromGroupAsync` must be called before broadcasting `PlayerLeft`. If the caller were still in the group at broadcast time, they would receive the departure event for themselves.

**`OnDisconnectedAsync` must not call `Groups.RemoveFromGroupAsync`.** SignalR automatically removes the `ConnectionId` from all groups on disconnect, as documented in `docs/realtime-communication.md#connection-lifecycle`. Manual removal is unnecessary and may have undefined behaviour on a closing connection.

**`NotInJamException` in `OnDisconnectedAsync` is not an error.** A client may disconnect without ever having joined a Jam. Catching `NotInJamException` silently at `Debug` log level is the correct response — no `HubException` or `Error` event is raised.

**`base.OnDisconnectedAsync(exception)` must always be called.** It must be the final statement in the override, reached even if `NotInJamException` was caught. Omitting it breaks SignalR's internal connection lifecycle tracking.

**`NewHostPlayerId` is null for non-Host departures.** The `HostChanged` event is only broadcast when `result.NewHostPlayerId != null`. The client must not perform a host indicator update when this field is absent.

**`IJamRepository.Remove` is new.** The existing `InMemoryJamRepository` does not have this method. Both the interface declaration and the implementation must be added in this ticket.

### Out of scope

- Phase-specific consequences of a Player leaving during Submission or Playback (e.g., handling orphaned Submissions or incomplete Guess sets).
- Any confirmation dialog or "are you sure?" prompt before leaving.
- Rejoining a Jam after having left — requires changes to the `JoinJam` flow deferred to a later ticket.
- Architecture test coverage for `IJamRepository.Remove`.

---

## Test Plan

> **For the human tester only.**
> Manual verification steps to execute after the Dev has finished, with both services running.

### Tooling

- Server running via `dotnet run` from `server/src/YtGuessWho.Api/` (default port `5030`).
- Angular dev server running via `pnpm start` from `client/` (`http://localhost:4200`).
- Three browser tabs: **Tab A** (Alice / initial Host), **Tab B** (Bob), **Tab C** (Carol).
- Browser DevTools → Console visible in each tab.
- Server terminal visible for log inspection.

### Preconditions

- Server and Angular dev server running with no startup errors.
- All tabs load `http://localhost:4200` without console errors.
- No active Jams exist (fresh server start).

---

### Scenario 1 — Non-Host Player Leaves

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | **Tab A**: type `Alice`, click **Create Jam** — note the Jam code | Alice's player list: `[Alice (Host)]` |
| 2 | **Tab B**: type `Bob`, enter the Jam code, click **Join Jam** | Both tabs show `[Alice (Host), Bob]` |
| 3 | **Tab B**: click **Leave Jam** | Button becomes disabled immediately |
| 4 | Wait for the server response | Tab B resets to the initial lobby form (no Jam code, no player list visible) |
| 5 | Observe **Tab A** without refreshing | Bob's entry has disappeared; Alice's list shows only `[Alice (Host)]` |
| 6 | Inspect server logs | `Information`-level entry confirms Bob left Jam; no host reassignment logged |

---

### Scenario 2 — Host Leaves, New Host Is Assigned

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | **Tab A**: create Jam as `Alice` | Alice's list: `[Alice (Host)]` |
| 2 | **Tab B**: join as `Bob` | Both tabs show `[Alice (Host), Bob]` |
| 3 | **Tab A**: click **Leave Jam** | Tab A resets to the lobby form |
| 4 | Observe **Tab B** without refreshing | Alice is gone; Bob now shows the Host indicator: `[Bob (Host)]` |
| 5 | Inspect server logs | Log confirms Alice left and Bob was promoted to Host |

---

### Scenario 3 — Last Player Leaves (Jam Disposed)

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | **Tab A**: create Jam as `Alice` — note the code | Alice's list: `[Alice (Host)]` |
| 2 | **Tab A**: click **Leave Jam** | Tab A resets to the lobby form |
| 3 | In **Tab B**, type any display name, enter Alice's old Jam code, click **Join Jam** | Error message displayed: Jam not found |
| 4 | Inspect server logs | Log confirms Alice left and the Jam was disposed |

---

### Scenario 4 — Host Leaves with Multiple Remaining Players (Random Promotion)

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | **Tab A**: create Jam as `Alice` | Alice's list: `[Alice (Host)]` |
| 2 | **Tab B**: join as `Bob`; **Tab C**: join as `Carol` | All three tabs show `[Alice (Host), Bob, Carol]` |
| 3 | **Tab A**: click **Leave Jam** | Tab A resets to the lobby form |
| 4 | Observe **Tab B** and **Tab C** | Alice is gone; exactly one of Bob or Carol shows the Host indicator — the other does not |
| 5 | Inspect server logs | Log confirms a new Host was assigned; only one Player's name appears as the new Host |

---

### Scenario 5 — Abrupt Disconnect (Browser Tab Closed)

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | **Tab A**: create Jam as `Alice` | Alice's list: `[Alice (Host)]` |
| 2 | **Tab B**: join as `Bob` | Both tabs show `[Alice (Host), Bob]` |
| 3 | Close **Tab B** entirely (do not click **Leave Jam**) | — |
| 4 | Wait 2–3 seconds, observe **Tab A** | Bob has disappeared from the list; Alice's list shows only `[Alice (Host)]` |
| 5 | Inspect server logs | Log confirms Bob's abrupt disconnect was handled and `PlayerLeft` was broadcast |

---

### Scenario 6 — Abrupt Disconnect of Host (Browser Tab Closed)

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | **Tab A**: create Jam as `Alice`; **Tab B**: join as `Bob` | Both tabs show `[Alice (Host), Bob]` |
| 2 | Close **Tab A** entirely | — |
| 3 | Wait 2–3 seconds, observe **Tab B** | Alice is gone; Bob shows the Host indicator: `[Bob (Host)]` |
| 4 | Inspect server logs | Log confirms Alice disconnected abruptly and Bob was promoted to Host |

---

### Scenario 7 — Leave Jam While Not In a Jam

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Open a fresh tab at `http://localhost:4200` — wait for connection | Lobby form displayed; no Jam joined |
| 2 | Open DevTools Console and run: `ng.getComponent(document.querySelector('app-lobby')).onLeaveJam()` | — |
| 3 | Observe the UI | An error message appears indicating the player is not in a Jam |
| 4 | Inspect server logs | A `Warning`-level entry records the `NOT_IN_JAM` rejection |

---

### Scenario 8 — In-Flight Button Disabled (No Double Submission)

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | **Tab A**: create Jam as `Alice` | Jam code and player list shown; **Leave Jam** button visible and enabled |
| 2 | Using DevTools, throttle the network to **Slow 3G** | — |
| 3 | Click **Leave Jam** | Button becomes disabled immediately |
| 4 | While the request is in flight, attempt to click the disabled button | Nothing happens |
| 5 | Wait for the response | Tab A resets to the lobby form |
| 6 | Remove the network throttle | — |

