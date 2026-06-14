# TICKET-004: Client SignalR Hub Connection with Status Display

## User Story

As a Player,
I want to see whether the application is connected to the game server and be able to connect or disconnect manually,
So that I know the real-time link is active and healthy before I attempt to create or join a Jam.

---

## Acceptance Criteria

- **Given** the application has just loaded,
  **When** the page is rendered,
  **Then** the connection status displays as **Disconnected** and a **Connect** button is visible and enabled.

- **Given** the application is in the Disconnected state,
  **When** the user clicks the **Connect** button,
  **Then** the button becomes disabled and reflects a pending state for the duration of the connection attempt.

- **Given** the connection attempt to `/hubs/game` succeeds,
  **When** the WebSocket handshake completes,
  **Then** the status displays as **Connected** and the button label changes to **Disconnect**.

- **Given** the application is in the Connected state,
  **When** the user clicks the **Disconnect** button,
  **Then** the connection is closed gracefully, the status returns to **Disconnected**, and the button label returns to **Connect**.

- **Given** the application is in the process of connecting or disconnecting,
  **When** the transition is in-flight,
  **Then** the button is disabled for the entire duration of the transition — no double-clicks are possible.

- **Given** the application attempts to connect,
  **When** the server is unreachable or the connection attempt fails,
  **Then** the status returns to **Disconnected**, the **Connect** button is re-enabled, and an error message is displayed to the user.

---

## Technical Notes

### Architecture placement
This ticket touches the client application only. The server-side `GameHub` at `/hubs/game` was established in ticket-002 and requires no changes here.

Within the Angular project, two units are introduced:

- **`HubConnectionService`** — a `core/` singleton service. Owns the entire `HubConnection` object lifecycle: building, starting, stopping, and exposing reactive state. Nothing outside this service interacts with `@microsoft/signalr` directly.
- **`ConnectionStatusComponent`** — a `shared/` presentational component. Reads state from `HubConnectionService` and renders status + action button. Has zero knowledge of SignalR internals.

This separation follows the Angular service-component boundary defined in `docs/guidelines/typescript-coding-standards.md` (§2.11) and the component size and responsibility rules (§2.10).

### Files to create or modify

| Action | File | Notes |
|--------|------|-------|
| Create | `client/src/app/core/hub-connection.service.ts` | Singleton service; builds `HubConnection`, exposes `connectionState` signal, `connect()` and `disconnect()` methods |
| Create | `client/src/app/core/hub-connection.service.spec.ts` | Unit tests for all public methods and state transitions |
| Create | `client/src/app/shared/connection-status/connection-status.component.ts` | Standalone, `OnPush` component; injects `HubConnectionService`; renders status and button |
| Create | `client/src/app/shared/connection-status/connection-status.component.scss` | Component-scoped styles for the status badge and button |
| Create | `client/src/app/shared/connection-status/connection-status.component.spec.ts` | Unit tests covering all rendered states and user interactions |
| Modify | `client/src/app/app.ts` | Import and include `ConnectionStatusComponent` in the root component template |
| Create | `client/src/environments/environment.ts` | Declare `hubUrl` pointing to `http://localhost:5001/hubs/game` for development |
| Create | `client/src/environments/environment.prod.ts` | Declare `hubUrl` for production — placeholder value for now |

### npm packages

| Package | Notes |
|---------|-------|
| `@microsoft/signalr` | Official SignalR JavaScript client. Install as a production dependency with `pnpm add @microsoft/signalr`. Provides `HubConnectionBuilder`, `HubConnection`, and `HubConnectionState`. |

### Key design constraints

**`HubConnectionService` design:**
- Must be `providedIn: 'root'` — one connection for the lifetime of the application.
- The `HubConnection` instance must be built once inside the service using `HubConnectionBuilder`, pointing to the `hubUrl` from the environment file.
- Connection state must be exposed as a `signal<HubConnectionState>` (using the `HubConnectionState` enum from `@microsoft/signalr`). The signal must be updated both from the result of `start()`/`stop()` calls **and** from the `onclose` callback registered on the connection — the `onclose` callback fires on abrupt disconnects that are not triggered by the application itself.
- `connect()` and `disconnect()` must be `async` methods returning `Promise<void>`. They must update the state signal and handle errors without leaking unhandled rejections.
- Two `computed()` signals must be derived: `isConnected` (`HubConnectionState.Connected`) and `isTransitioning` (`Connecting` or `Disconnecting`). The component uses these, never inspecting `HubConnectionState` values directly.
- The service must never be instantiated more than once. The `HubConnection` object must not be re-created between reconnection attempts — call `start()` again on the existing instance.

**`ConnectionStatusComponent` design:**
- `standalone: true`, `ChangeDetectionStrategy.OnPush`, selector `app-connection-status`.
- Inject `HubConnectionService` via `inject()`.
- The button must be `disabled` whenever `isTransitioning()` is true.
- Button label: `'Connect'` when not connected, `'Disconnect'` when connected.
- The button click handler calls `connect()` or `disconnect()` on the service depending on current state — the component never manages connection logic directly.
- Status display must read from `connectionState()` and render a human-readable label. Use a mapping from `HubConnectionState` values to display strings — do not use raw enum values in the template.
- All branching over `HubConnectionState` values must be exhaustive. Use the `never`-check pattern defined in `docs/guidelines/typescript-coding-standards.md` (§2.3, rule 14).

**Environment configuration:**
- `hubUrl` must be read from the Angular environment file, not hard-coded in the service. This makes the URL configurable per environment without changing service code.
- Wire the environment files via `fileReplacements` in `angular.json` under the `production` build configuration.

**No automatic reconnection in this ticket:**
- `HubConnectionBuilder` must not configure automatic reconnect (`.withAutomaticReconnect()`). Manual reconnection via the Connect button is the only supported flow in this ticket. Automatic reconnection is out of scope and will be addressed in a dedicated ticket.

### Out of scope
- Automatic reconnection logic (`withAutomaticReconnect`).
- Associating the connection with a Jam (`CreateJam` / `JoinJam` hub methods).
- Persisting or restoring connection state across page refreshes.
- Authentication or token-based hub access.
- Production `hubUrl` configuration — a placeholder value is sufficient.

---

## Test Plan

> **For the human tester only.**
> Manual verification steps to execute after the Dev has finished, with both client and server running locally.

### Tooling
- Server running via `dotnet run` from `server/src/YtGuessWho.Api/` (or equivalent).
- Angular dev server running via `pnpm start` from `client/` (see `docs/web-client-documentation.md` — Local Runbook).
- Browser open at `http://localhost:4200`.
- Browser DevTools — **Network** tab filtered to **WS** (WebSocket), and **Console** tab visible.

### Preconditions
- Server is running and `/health` returns `200 OK`.
- Angular dev server is running and the page loads without console errors.
- No existing WebSocket connections are open (fresh page load).

---

### Scenario 1 — Initial Disconnected State

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Load `http://localhost:4200` in the browser | Page renders without errors |
| 2 | Observe the connection status area | Status label reads **Disconnected** (or equivalent) |
| 3 | Observe the button | Button is labelled **Connect** and is enabled |
| 4 | Open DevTools → Network → WS | No WebSocket connection is present |

---

### Scenario 2 — Successful Connection

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Click the **Connect** button | Button becomes disabled immediately |
| 2 | Observe the button label while connecting | Label reflects a pending state (e.g. **Connecting…** or button is disabled) |
| 3 | Wait for the connection to complete | Status label updates to **Connected** |
| 4 | Observe the button after connection | Button is re-enabled and labelled **Disconnect** |
| 5 | Open DevTools → Network → WS | A WebSocket connection to `ws://localhost:5001/hubs/game` is listed with status **101 Switching Protocols** |

---

### Scenario 3 — Graceful Disconnect

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Ensure the application is in the **Connected** state (complete Scenario 2 first) | Status shows **Connected** |
| 2 | Click the **Disconnect** button | Button becomes disabled immediately |
| 3 | Wait for the disconnection to complete | Status label returns to **Disconnected** |
| 4 | Observe the button | Button is re-enabled and labelled **Connect** |
| 5 | Open DevTools → Network → WS | The WebSocket entry shows as closed (no longer receiving frames) |

---

### Scenario 4 — Connection Failure (Server Unavailable)

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Stop the server (`Ctrl+C` in the server terminal) | Server is no longer running |
| 2 | With the app showing **Disconnected**, click **Connect** | Button becomes disabled during the attempt |
| 3 | Wait for the connection attempt to time out or fail | Status returns to **Disconnected** |
| 4 | Observe the button | **Connect** button is re-enabled |
| 5 | Observe the UI | An error message is displayed to the user (not just a console error) |
| 6 | Open DevTools → Console | No unhandled promise rejection is logged |

---

### Scenario 5 — Repeated Connect / Disconnect Cycle

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Connect (Scenario 2), then Disconnect (Scenario 3), then Connect again | Each cycle completes without errors |
| 2 | After three cycles, observe the DevTools Console | No errors, no memory leak warnings, no duplicate WebSocket connections open simultaneously |
| 3 | Open DevTools → Network → WS | Each connection attempt opens a new WebSocket entry; each disconnect closes it |

