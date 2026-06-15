# TICKET-007: Broadcast Player List When a Player Joins

## User Story

As a Player in a Jam,
I want to see the live list of Players in the Jam lobby,
So that I know who is connected and can identify the Host.

---

## Acceptance Criteria

- **Given** a Player has just created a Jam,
  **When** the `CreateJam` hub method completes,
  **Then** the creating Player's client receives a `PlayerJoined` event for themselves (`isHost = true`), and the UI displays them as the sole Player in the list.

- **Given** a Jam exists with one or more Players,
  **When** a new Player successfully joins via `JoinJam`,
  **Then** the joining Player's client receives one `PlayerJoined` event per Player currently in the Jam (including themselves), and the UI displays the full Player list with the Host visually identified.

- **Given** a Jam exists with one or more Players,
  **When** a new Player successfully joins via `JoinJam`,
  **Then** every other Player already in the Jam receives a single `PlayerJoined` event for the new Player only, and their UI appends the new Player to the displayed list without a page reload.

- **Given** a Player is viewing the Jam lobby after joining or creating,
  **When** the Player list is rendered,
  **Then** the Host entry is visually distinguished from non-Host entries.

- **Given** a Player has not yet created or joined a Jam,
  **When** the lobby form is displayed,
  **Then** no Player list is visible on the screen.

---

## Technical Notes

### Architecture placement

This ticket touches **Application** (new query method and DTO), **Infrastructure** (hub broadcast logic, `IGameHubClient` contract completion), and the **Angular client** (event listener, component rendering). Layer responsibilities and the SignalR hub contract are fully defined in `docs/solution-architecture.md#layer-responsibilities` and `docs/realtime-communication.md#hub-design`.

### Files to create or modify

#### Application — `YtGuessWho.Application`

| Action | File | Notes |
|--------|------|-------|
| Create | `src/YtGuessWho.Application/DTOs/PlayerSnapshot.cs` | Immutable record: `PlayerId (string)`, `DisplayName (string)`, `IsHost (bool)`. Carries player data out of the Application layer without exposing domain entities. |
| Modify | `src/YtGuessWho.Application/Services/IJamService.cs` | Add `Task<IReadOnlyList<PlayerSnapshot>> GetPlayers(string jamCode, CancellationToken cancellationToken = default)`. |
| Modify | `src/YtGuessWho.Application/Services/Implementations/JamService.cs` | Implement `GetPlayers`: call `_repository.FindByCode(jamCode)`, throw `JamNotFoundException` if `null`, return `jam.Players` mapped to `PlayerSnapshot`. Log at `Debug` level. |

#### Infrastructure — `YtGuessWho.Infrastructure`

| Action | File | Notes |
|--------|------|-------|
| Create | `src/YtGuessWho.Infrastructure/Hubs/Payloads/PlayerJoinedPayload.cs` | Immutable record: `PlayerId (string)`, `DisplayName (string)`, `IsHost (bool)`. Wire-level DTO — kept separate from `PlayerSnapshot` to respect the dependency matrix in `docs/solution-architecture.md#dependency-matrix`. |
| Modify | `src/YtGuessWho.Infrastructure/Hubs/IGameHubClient.cs` | Add `Task PlayerJoined(PlayerJoinedPayload payload)`. This completes the contract entry defined in `docs/realtime-communication.md#igamehubclient`. |
| Modify | `src/YtGuessWho.Infrastructure/Hubs/GameHub.cs` | **`CreateJam`**: after the service call and group add (ticket-005), call `_jamService.GetPlayers(jamCode)`, then send `PlayerJoined` for each result to `Clients.Caller`. **`JoinJam`**: after the service call and group add (ticket-006), call `_jamService.GetPlayers(jamCode)` to obtain the full list (which already includes the new Player); send `PlayerJoined` for each Player in the list to `Clients.Caller`; then send `PlayerJoined` for only the new Player to `Clients.GroupExcept(jamCode, new[] { Context.ConnectionId })`. |

#### Tests — `YtGuessWho.Tests`

| Action | File | Notes |
|--------|------|-------|
| Create | `tests/YtGuessWho.Tests/Application/JamServiceGetPlayersTests.cs` | Unit tests for `JamService.GetPlayers`. Cover: returns one `PlayerSnapshot` per player with correct `PlayerId`, `DisplayName`, and `IsHost` values; `IsHost` is `true` only for the player whose `IsHost` flag is set on the domain entity; throws `JamNotFoundException` when the jam code is unknown. |

#### Client — `client/`

| Action | File | Notes |
|--------|------|-------|
| Create | `client/src/app/core/models/player.model.ts` | TypeScript interface `Player` with `playerId: string`, `displayName: string`, `isHost: boolean`. Shared client model; imported wherever player data is referenced. |
| Modify | `client/src/app/core/hub-connection.service.ts` | Add `onPlayerJoined(handler: (player: Player) => void): void` — thin delegation to `this.#connection.on('PlayerJoined', handler)`. No state management in the service. |
| Modify | `client/src/app/core/hub-connection.service.spec.ts` | Add tests: `onPlayerJoined` calls `connection.on` with event name `'PlayerJoined'` and the provided handler; invoking the mock event fires the handler with the correct payload. |
| Modify | `client/src/app/lobby/lobby.component.ts` | Add `players` signal (`signal<Player[]>([])`). In the constructor, after injecting `hubService`, register: `hubService.onPlayerJoined(player => this.players.update(list => [...list, player]))`. Reset `players` to `[]` at the start of `onCreateJam` and `onJoinJam` (before the hub call) so the list is clean on retries. In the success view (when `jamCode()` is not `null`), render the player list beneath the Jam code. |
| Modify | `client/src/app/lobby/lobby.component.spec.ts` | Add tests: a `PlayerJoined` event appends a player to `players()`; multiple events append in order; the Host entry is distinguished in the rendered template; `players` resets to an empty array when `onCreateJam` or `onJoinJam` is called again. |
| Modify | `client/src/app/lobby/lobby.component.scss` | Add styles for `.player-list` (vertical list container) and `.player-list__item` (individual entry). The Host entry should carry a distinct visual indicator — e.g. a `(Host)` label styled with the accent colour defined in `docs/design/color-palette.md`. |

### NuGet packages

None — this ticket requires no new server-side packages.

### Key design constraints

**`PlayerJoined` is the sole mechanism for populating the player list.** There is no separate "snapshot" event. The Hub sends `PlayerJoined` once per Player in sequence — either to `Clients.Caller` (for the full list) or to `Clients.GroupExcept` (for the delta). The client simply appends on every event.

**Order of Hub calls in `JoinJam`.** `GetPlayers` must be called **after** `_jamService.JoinJam` succeeds, so the returned list already includes the joining Player. Sequence: (1) `JoinJam` service call, (2) `Groups.AddToGroupAsync`, (3) `GetPlayers`, (4) send full list to `Clients.Caller`, (5) send new player only to `Clients.GroupExcept`. This ordering guarantees the joiner sees themselves in their own snapshot, and existing members do not receive a duplicate event for the new player.

**`Clients.GroupExcept` prevents duplicate events.** The joining Player was already added to the group in step 2. Without `GroupExcept`, they would receive a second `PlayerJoined` event for themselves from the group broadcast. Use `Clients.GroupExcept(jamCode, new[] { Context.ConnectionId })` to target only existing members.

**`PlayerJoinedPayload` ≠ `PlayerSnapshot`.** Both records share the same fields in V1, but `PlayerSnapshot` lives in Application and `PlayerJoinedPayload` lives in Infrastructure. They must not be merged — doing so would violate the dependency matrix in `docs/solution-architecture.md#dependency-matrix`.

**`onPlayerJoined` registration timing.** The SignalR JS client buffers `connection.on` registrations regardless of connection state, so the listener registered in the component constructor is safe even when the connection has already started. No special lifecycle handling is needed.

**`players` signal is additive.** The component appends on every `PlayerJoined` event. Clearing the list before a new hub invocation is the component's responsibility. No server-side deduplication guard is needed — the server guarantees no duplicate events within a single join.

### Out of scope

- Removing a player from the UI when they disconnect (`PlayerLeft` broadcast — deferred).
- Any player management by the Host (kick, promote, etc.).
- Displaying any player field beyond `displayName` and host indicator.
- Handling `PlayerJoined` events outside the Lobby view (no global listener yet).
- Player list ordering beyond server-side insertion order.

---

## Test Plan

> **For the human tester only.**
> Manual verification steps to execute after the Dev has finished, with both services running.

### Tooling

- Server running via `dotnet run` from `server/src/YtGuessWho.Api/` (default port `5030`).
- Angular dev server running via `pnpm start` from `client/` (`http://localhost:4200`).
- Three browser tabs open: **Tab A** (Alice / Host), **Tab B** (Bob), **Tab C** (Carol).
- Browser DevTools → Console visible in each tab.

### Preconditions

- Server and Angular dev server running with no startup errors.
- All tabs load `http://localhost:4200` without console errors.
- No active Jams exist (fresh server start).

---

### Scenario 1 — Host Sees Their Own Entry After Creating

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | In **Tab A**, type `Alice` and click **Create Jam** | Jam code is displayed prominently |
| 2 | Observe the area below the Jam code | A player list appears containing exactly one entry: `Alice` with a Host indicator |

---

### Scenario 2 — Joiner Sees Full Player List (Including Host)

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | In **Tab A**, create a Jam as `Alice` — note the Jam code | Alice's player list: `[Alice (Host)]` |
| 2 | In **Tab B**, type `Bob`, enter the Jam code, click **Join Jam** | Jam code shown in Tab B |
| 3 | Observe the player list in **Tab B** | The list shows two entries: `Alice` (with Host indicator) and `Bob` |

---

### Scenario 3 — Existing Players See the New Player Arrive

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | In **Tab A**, create a Jam as `Alice` | Alice's list: `[Alice (Host)]` |
| 2 | In **Tab B**, join as `Bob` | — |
| 3 | Observe the player list in **Tab A** — do not refresh | `Bob` has appeared below `Alice` in the list |

---

### Scenario 4 — Three Players See a Consistent List

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | **Tab A**: create Jam as `Alice` | Alice's list: `[Alice (Host)]` |
| 2 | **Tab B**: join as `Bob` | Bob's list: `[Alice (Host), Bob]`; Alice's list: `[Alice (Host), Bob]` |
| 3 | **Tab C**: join as `Carol` | Carol's list: `[Alice (Host), Bob, Carol]`; Alice's list: `[Alice (Host), Bob, Carol]`; Bob's list: `[Alice (Host), Bob, Carol]` |

---

### Scenario 5 — Player List Not Visible Before Joining

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Open a fresh tab at `http://localhost:4200` | Lobby form displayed |
| 2 | Do not click any button | No player list section is visible anywhere on the page |

---

### Scenario 6 — No Duplicate Entry on Retry

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | In **Tab A**, create a Jam as `Alice` | Alice's list: `[Alice (Host)]` |
| 2 | Stop the server (`Ctrl+C`) | Connection error shown |
| 3 | Restart the server | — |
| 4 | In **Tab A** (or a fresh tab), create a new Jam | Alice's list contains exactly one entry — the list from the previous attempt is not visible |

