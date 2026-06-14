# YtGuessWho — Real-Time Communication Layer

> **Status:** Accepted — active reference for all implementation work.
> Architectural decision recorded in [`docs/adr/ADR-002-signalr-realtime-transport.md`](./adr/ADR-002-signalr-realtime-transport.md).

---

## Overview

All real-time communication between the server and connected players is handled exclusively by **ASP.NET Core SignalR**. SignalR is the single delivery mechanism for every game event — it is the boundary between the outside world and the application core.

SignalR types (`Hub`, `IHubContext`, `IGameHubClient`) are confined to the **Infrastructure layer** (`YtGuessWho.Infrastructure`). No SignalR namespace, type, or concept crosses into `Application` or `Domain`. The Hub is a thin translation layer: it receives a client call, delegates to an application service, and pushes the result back out as a typed event.

---

## Placement in Clean Architecture

```
YtGuessWho.Infrastructure/
└── Hubs/
    ├── GameHub.cs            ← Hub: receives client calls, pushes server events
    └── IGameHubClient.cs     ← Strongly-typed interface for server → client events
```

`GameHub` depends on `IJamService` and `IScoringService` (defined in `YtGuessWho.Application`). It never instantiates domain objects directly and never enforces domain rules. Its only job is to translate the wire protocol into application commands and application results back into wire events.

---

## Connection Model

SignalR assigns every connected client a unique `ConnectionId` (a server-generated string). In YtGuessWho this `ConnectionId` serves as the `PlayerId` for the duration of the connection.

```
Client connects
    │
    ▼
OnConnectedAsync()
    │  ← ConnectionId is available here; no Jam association yet
    ▼
Client calls CreateJam / JoinJam
    │  ← Player is added to a SignalR Group keyed by JamCode
    ▼
Game events flow to all members of that Group
    │
    ▼
OnDisconnectedAsync()
       └─ Player is removed from Jam; PlayerLeft broadcast to group
```

**Groups map directly to Jams.** When a player joins a Jam, the server calls:

```
await Groups.AddToGroupAsync(Context.ConnectionId, jam.JamCode);
```

All subsequent broadcasts to that Jam use:

```
await Clients.Group(jam.JamCode).SomeEvent(payload);
```

This means the server never maintains a manual registry of connection-to-Jam mappings for broadcast purposes — SignalR's group mechanism handles it.

---

## Hub Design

### `IGameHubClient` — Strongly-Typed Client Interface

This interface defines every event the server is allowed to push to clients. It is the **official server → client contract**. Adding a new event means adding a method here first.

```
IGameHubClient
├── PlayerJoined(PlayerJoinedPayload payload)
├── PlayerLeft(PlayerLeftPayload payload)
├── PhaseChanged(PhaseChangedPayload payload)
├── AllSubmissionsReceived()
├── RoundStarted(RoundStartedPayload payload)
├── GuessSubmitted(GuessSubmittedPayload payload)
├── RoundEnded(RoundEndedPayload payload)
├── GameEnded(GameEndedPayload payload)
└── Error(ErrorPayload payload)
```

`GameHub` is declared as `Hub<IGameHubClient>`. This means `Clients.Group(...)` returns `IGameHubClient` — the compiler rejects any attempt to push an event that is not on the interface.

### `GameHub` — Client-Callable Methods

These are the methods a client may invoke. Each validates the caller's state before delegating to the application layer.

| Method | Parameters | Auth rule |
|--------|-----------|-----------|
| `CreateJam` | `string displayName` | Any connected client |
| `JoinJam` | `string jamCode, string displayName` | Any connected client not already in a Jam |
| `SubmitSong` | `string youtubeUrl` | Player in a Jam at `Submission` phase |
| `SubmitGuess` | `string guessedPlayerId` | Player in a Jam at `Playback` phase, round active |
| `AdvancePhase` | — | Host only |
| `LeaveJam` | — | Any player currently in a Jam |

---

## Connection Lifecycle

### `OnConnectedAsync`
- A raw WebSocket connection is established.
- No game state is created or mutated.
- `Context.ConnectionId` is available but not yet associated with any Jam.

### `OnDisconnectedAsync(Exception? exception)`
- Triggered on both graceful (`LeaveJam`) and abrupt (browser closed, network drop) disconnects.
- The Hub must call the application layer to remove the player from their active Jam (if any).
- If the disconnecting player was the **Host**, the application layer decides the resolution (e.g., promote the next player, or dissolve the Jam — behaviour defined in the domain).
- After the application layer completes, the Hub broadcasts `PlayerLeft` to the remaining group members.
- SignalR automatically removes the `ConnectionId` from all groups on disconnect — no manual cleanup needed.

---

## Server → Client Event Reference

All payloads are serialised as JSON over the wire.

### `PlayerJoined`
Broadcast to the entire Jam group when a new player successfully joins.
```
{
  "playerId":    string,   // ConnectionId of the new player
  "displayName": string,
  "isHost":      boolean
}
```

### `PlayerLeft`
Broadcast to the remaining Jam group when a player disconnects.
```
{
  "playerId": string
}
```

### `PhaseChanged`
Broadcast to the entire Jam group when the Host advances the phase.
```
{
  "newPhase": string   // "Lobby" | "Submission" | "Playback" | "Results"
}
```

### `AllSubmissionsReceived`
Broadcast to the entire Jam group when every player has submitted a song URL. No payload — the event itself is the signal.

### `RoundStarted`
Broadcast at the beginning of each Playback round. The `youtubeUrl` is the anonymous submission — **no owner identity is included**.
```
{
  "roundIndex": number,
  "youtubeUrl": string
}
```

### `GuessSubmitted`
Broadcast to the group each time any player submits a guess, so clients can show a "waiting for N players" indicator. **Does not reveal the guess content.**
```
{
  "playerId": string   // who submitted, not what they guessed
}
```

### `RoundEnded`
Broadcast when all players have submitted a guess for the current round. Reveals truth and score changes.
```
{
  "roundIndex":     number,
  "correctOwnerId": string,                         // who the song actually belonged to
  "guesses":        { [playerId: string]: string }, // each player's guess (guessedPlayerId)
  "scoresDelta":    { [playerId: string]: number }  // points earned this round per player
}
```

### `GameEnded`
Broadcast when all rounds are complete.
```
{
  "finalScores": [
    { "playerId": string, "displayName": string, "score": number }
  ]
}
```

### `Error`
Sent only to the **caller** (not the group) when a hub method call fails validation or violates a game rule.
```
{
  "code":    string,   // machine-readable error code (see below)
  "message": string    // human-readable description
}
```

---

## Error Code Reference

| Code | Triggered when |
|------|---------------|
| `JAM_NOT_FOUND` | `JoinJam` called with a code that does not match any active Jam |
| `JAM_NOT_JOINABLE` | `JoinJam` called on a Jam that is not in `Lobby` phase |
| `JAM_FULL` | `JoinJam` called on a Jam that has reached the maximum player count |
| `ALREADY_IN_JAM` | Player calls `CreateJam` or `JoinJam` while already associated with a Jam |
| `NOT_IN_JAM` | Any game action is called before the player has joined a Jam |
| `UNAUTHORIZED` | A non-Host player calls `AdvancePhase` |
| `INVALID_YOUTUBE_URL` | `SubmitSong` called with a string that fails `YoutubeUrl` validation |
| `ALREADY_SUBMITTED` | `SubmitSong` called by a player who has already submitted in this Jam |
| `ALREADY_GUESSED` | `SubmitGuess` called by a player who has already guessed in this round |
| `INVALID_PHASE` | Any action called when the Jam is not in the expected phase |
| `INVALID_PLAYER` | `SubmitGuess` references a `playerId` that does not exist in the Jam |

---

## Message Flow by Game Phase

### Lobby

```
Client A                        Server                         Client B
   │                               │                               │
   │──── CreateJam("Alice") ──────►│                               │
   │◄─── PlayerJoined(Alice,host) ─│                               │
   │                               │                               │
   │                               │◄────── JoinJam(code,"Bob") ───│
   │◄─── PlayerJoined(Bob) ────────│──────► PlayerJoined(Bob) ─────│
```

### Submission

```
Client A                        Server                         Client B
   │                               │                               │
   │──── AdvancePhase() ──────────►│                               │
   │◄─── PhaseChanged(Submission) ─│──────► PhaseChanged(Sub.) ────│
   │                               │                               │
   │──── SubmitSong(urlA) ────────►│                               │
   │                               │◄────── SubmitSong(urlB) ──────│
   │◄─── AllSubmissionsReceived() ─│──────► AllSubmissionsReceived()│
```

### Playback & Guessing (one round)

```
Client A                        Server                         Client B
   │                               │                               │
   │──── AdvancePhase() ──────────►│                               │
   │◄─── PhaseChanged(Playback) ───│──────► PhaseChanged(Playback)─│
   │◄─── RoundStarted(0, urlA) ────│──────► RoundStarted(0, urlA) ─│
   │                               │                               │
   │──── SubmitGuess(playerB) ────►│                               │
   │◄─── GuessSubmitted(playerA) ──│──────► GuessSubmitted(playerA)│
   │                               │◄────── SubmitGuess(playerA) ──│
   │◄─── RoundEnded(...) ──────────│──────► RoundEnded(...) ────────│
```

### Results

```
Client A                        Server                         Client B
   │                               │                               │
   │──── AdvancePhase() ──────────►│                               │
   │◄─── PhaseChanged(Results) ────│──────► PhaseChanged(Results) ─│
   │◄─── GameEnded(finalScores) ───│──────► GameEnded(finalScores) ─│
```

---

## Error Flow

Errors are never broadcast to the group. They are sent exclusively to the caller via `Clients.Caller`.

```
Client A                        Server
   │                               │
   │──── AdvancePhase() ──────────►│  (caller is not Host)
   │◄─── Error(UNAUTHORIZED) ──────│
   │                               │  (no event sent to group)
```

---

## Transport & Configuration

SignalR is registered and mapped in the `Api` layer (`Program.cs`). The Infrastructure layer provides the Hub and interface; the Api layer wires them to the ASP.NET Core pipeline.

```
// Api layer — Program.cs
builder.Services.AddSignalR();
app.MapHub<GameHub>("/hubs/game");
```

### WebSocket Preferred

SignalR negotiates the best available transport in this order:
1. **WebSockets** (preferred — used in all modern browsers)
2. **Server-Sent Events** (fallback)
3. **Long Polling** (last resort)

For V1, only WebSockets are expected in practice. The fallback transports are available for free and should not be disabled.

### CORS

The web client origin must be explicitly allowed in `appsettings.json`. The SignalR handshake is subject to the same CORS policy as the rest of the API.

```json
"Cors": {
  "AllowedOrigins": [ "http://localhost:5173" ]
}
```

---

## Scale-Out Path (Future)

The current V1 in-memory model assumes a **single server instance**. If horizontal scaling is required in a future milestone, add the Redis backplane:

```
builder.Services.AddSignalR()
    .AddStackExchangeRedis(connectionString);
```

This is a single-line change in `Program.cs` and a new NuGet package (`Microsoft.AspNetCore.SignalR.StackExchangeRedis`). No Hub, interface, or domain code changes.

---

## Rules for Implementors

1. **No domain logic in the Hub.** `GameHub` calls application services and translates results to events. Invariant enforcement belongs in the Domain layer.
2. **No SignalR types outside Infrastructure.** `IHubContext<GameHub>`, `Hub`, and `Clients` must not appear in `Application` or `Domain`.
3. **Errors go to the caller only.** Never broadcast an `Error` event to a group.
4. **Group name = JamCode.** The SignalR group key is always the `Jam.JamCode` string — no other convention.
5. **`IGameHubClient` is the contract.** Any new server → client event requires a new method on `IGameHubClient` first. No magic strings.
6. **`ConnectionId` = `PlayerId`.** For the lifetime of a connection, the SignalR `ConnectionId` is the player's identity. No separate ID generation needed.

