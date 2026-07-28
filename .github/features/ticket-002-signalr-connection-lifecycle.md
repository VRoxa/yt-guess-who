# TICKET-002: SignalR Hub Bootstrap & Connection Lifecycle

## User Story

As a player,
I want to open and maintain a persistent WebSocket connection to the game server,
So that I can receive real-time game events once I join a Jam in a subsequent step.

---

## Acceptance Criteria

- **Given** the application is running,
  **When** a client sends a SignalR negotiate request to `/hubs/game`,
  **Then** the server responds with `200 OK` and a valid negotiation payload.

- **Given** the application is running,
  **When** a client completes the WebSocket upgrade to `/hubs/game`,
  **Then** the connection is established and the server assigns a `ConnectionId` without error.

- **Given** a connected client,
  **When** the client closes the connection gracefully,
  **Then** the server completes `OnDisconnectedAsync` without throwing an unhandled exception.

- **Given** a connected client that drops without a graceful close,
  **When** the server detects the abrupt disconnect,
  **Then** the server completes `OnDisconnectedAsync` with the exception parameter populated, without crashing the process.

- **Given** a client connecting from any origin,
  **When** the connection is established,
  **Then** the server does not reject it with a CORS error — any origin is permitted.

- **Given** the application is running,
  **When** any route other than `/health` or `/hubs/game` is requested,
  **Then** it still returns `404 Not Found` — no unintended endpoints are introduced.

---

## Technical Notes

### Architecture placement

This ticket touches two layers:
- **Infrastructure** — `GameHub` and `IGameHubClient` live here, as defined in `docs/realtime-communication.md#placement-in-clean-architecture`.
- **Api** — SignalR registration, CORS policy, and hub route mapping live here, as defined in `docs/solution-architecture.md#layer-4--ytguesswhoapiapi` and `docs/realtime-communication.md#transport--configuration`.

### Files to create or modify

| Action | File | Notes |
|--------|------|-------|
| Modify | `src/YtGuessWho.Infrastructure/YtGuessWho.Infrastructure.csproj` | Add `<FrameworkReference Include="Microsoft.AspNetCore.App" />` — required for `Hub<T>` to resolve in a class library project |
| Create | `src/YtGuessWho.Infrastructure/Hubs/IGameHubClient.cs` | Full server→client event contract; declare all methods per `docs/realtime-communication.md#igamehubclient--strongly-typed-client-interface` — none are invoked in this ticket but the interface must be complete for `Hub<IGameHubClient>` to compile |
| Create | `src/YtGuessWho.Infrastructure/Hubs/GameHub.cs` | Declare as `Hub<IGameHubClient>`; implement `OnConnectedAsync` and `OnDisconnectedAsync` lifecycle overrides only; no hub methods (`CreateJam`, `JoinJam`, etc.) in this ticket |
| Modify | `src/YtGuessWho.Api/Program.cs` | Add CORS policy (allow any origin — see constraints), call `app.UseCors()` before `app.MapHub<GameHub>("/hubs/game")`, register `AddSignalR()` |

### NuGet packages

No additional NuGet packages are required. `Microsoft.AspNetCore.SignalR` ships as part of the `Microsoft.AspNetCore.App` shared framework. Accessing it from `YtGuessWho.Infrastructure` requires only the `FrameworkReference` listed in the files table above.

### Key design constraints

**CORS — allow any origin (this ticket only).** The connection model and the production CORS pattern (origin whitelist in `appsettings.json`) are defined in `docs/realtime-communication.md#cors`. For this ticket, use a permissive policy that allows any origin, any method, and any header. Do not call `AllowCredentials()` alongside `AllowAnyOrigin()` — the two are incompatible and SignalR does not require credentials for the WebSocket upgrade. The origin-restricted policy is deferred to a later ticket.

**Middleware ordering.** `app.UseCors()` must be called after `app.UseRouting()` (if present) and **before** `app.MapHub<>`. Placing it after the hub mapping causes the CORS headers to be absent from the negotiate response.

**`OnConnectedAsync` — no game state.** Per `docs/realtime-communication.md#onconnectedasync`, this override must not create or mutate any game state. A structured log entry at `Information` level is sufficient.

**`OnDisconnectedAsync` — Jam cleanup deferred.** The full disconnect behaviour (removing the Player from a Jam, broadcasting `PlayerLeft`, handling Host disconnection) is defined in `docs/realtime-communication.md#ondisconnectedasync`. That logic requires a Jam context that does not exist until ticket-003+. For this ticket, the override should log the disconnect and accept the exception parameter gracefully — no application service calls yet.

**`IGameHubClient` must be declared in full.** All nine server→client methods (`PlayerJoined`, `PlayerLeft`, `PhaseChanged`, `AllSubmissionsReceived`, `RoundStarted`, `GuessSubmitted`, `RoundEnded`, `GameEnded`, `Error`) must be present. Their payload types can be declared as empty records in the same file or in a `Payloads/` subfolder — their fields are fully specified in `docs/realtime-communication.md#server--client-event-reference`. Do not leave any method stubbed with a `throw NotImplementedException`; the interface is a contract, not an abstract class.

**No hub methods in this ticket.** `CreateJam`, `JoinJam`, `SubmitSong`, `SubmitGuess`, `AdvancePhase`, and `LeaveJam` are out of scope. Adding them in this ticket would require Application services that do not exist yet.

### Automated testing

This ticket introduces code exclusively in the `Infrastructure` layer. `YtGuessWho.Tests` cannot
reference `Infrastructure` without violating the dependency matrix in
`docs/solution-architecture.md#dependency-matrix`. **No unit tests are written for this ticket.**
Runtime behaviour is fully covered by the manual Test Plan below. This exception is codified in
`dev.agent.md` under *Infrastructure-only tickets — accepted exception*.

### Out of scope

- All hub methods (`CreateJam`, `JoinJam`, `SubmitSong`, `SubmitGuess`, `AdvancePhase`, `LeaveJam`).
- `PlayerLeft` broadcast — no Jam group to broadcast to at this stage.
- Origin-restricted CORS policy and `appsettings.json` configuration for allowed origins.
- Any Domain entities, Application services, or repository interfaces.
- Reconnection / session recovery after abrupt disconnect (explicitly deferred in `docs/context.md#out-of-scope`).

---

## Test Plan

> For the **human tester only.**
> Run these steps after the Dev has completed the implementation and `dotnet build` succeeds.
> Do not run these steps until the application is started.

### Tooling

- The application started locally with `dotnet run` from `src/YtGuessWho.Api/` (or via the Rider run configuration).
- Note the HTTP port from `src/YtGuessWho.Api/Properties/launchSettings.json` — assumed `http://localhost:5000` below; substitute your actual port.
- The `YtGuessWho.Api/YtGuessWho.Api.http` file and any HTTP client (Rider's built-in, VS Code REST Client, or `curl`).
- A browser (Chrome or Firefox) with DevTools open.

### Preconditions

- `dotnet build` completes with zero errors.
- The application is running (`dotnet run` output shows "Now listening on: http://localhost:5000").
- No other process is bound to the same port.

---

### Scenario 1 — Health check still works after changes

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Send `GET http://localhost:5000/health` | `200 OK` |

---

### Scenario 2 — Hub negotiate endpoint is reachable

SignalR clients always begin with an HTTP POST to negotiate the connection before upgrading to WebSockets.

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Send `POST http://localhost:5000/hubs/game/negotiate?negotiateVersion=1` with an empty body | `200 OK` with a JSON body containing a `connectionToken` string and a `connectionId` string |
| 2 | Note the value of `connectionId` in the response | It is a non-empty string (this is the `PlayerId` for this connection) |

---

### Scenario 3 — Unknown route is still 404

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Send `GET http://localhost:5000/anything-else` | `404 Not Found` |

---

### Scenario 4 — Full WebSocket connection and graceful disconnect

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Open a new browser tab and navigate to `about:blank` | Blank page loads |
| 2 | Open DevTools (F12) → Console tab | Console is ready |
| 3 | In the Console, load the SignalR JS client by creating a script element whose `src` points to `https://unpkg.com/@microsoft/signalr@latest/dist/browser/signalr.min.js`, then append it to `document.head` | No console errors; after a moment, `signalR` is defined as a global |
| 4 | In the Console, build a `HubConnectionBuilder` targeting `http://localhost:5000/hubs/game` and call `.build()` to create a connection object | No errors; a connection object is printed |
| 5 | Call `.start()` on the connection object | The promise resolves without error; the connection state transitions to `Connected` |
| 6 | Call `.stop()` on the connection object | The promise resolves without error; the connection state transitions to `Disconnected` |
| 7 | Check the terminal running `dotnet run` | Two log lines are visible: one for `OnConnectedAsync` (connection established) and one for `OnDisconnectedAsync` (connection closed) — no error or exception stack traces |

---

### Scenario 5 — CORS allows connection from any origin

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Send `POST http://localhost:5000/hubs/game/negotiate?negotiateVersion=1` with the request header `Origin: http://totally-different-origin.example.com` | `200 OK`; response contains `Access-Control-Allow-Origin: *` (or the specific request origin) — no `403` or missing CORS header |

---

### Scenario 6 — Abrupt disconnect does not crash the server

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Repeat steps 1–5 of Scenario 4 to establish a connected client | Connection is in `Connected` state |
| 2 | Close the browser tab entirely without calling `.stop()` | Tab closes |
| 3 | Wait 5 seconds, then check the terminal running `dotnet run` | `OnDisconnectedAsync` log line appears; the application process is still running and continues to accept requests — no crash, no unhandled exception log |
| 4 | Send `GET http://localhost:5000/health` again | `200 OK` — confirms the server is still alive |

