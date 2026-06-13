# ADR-002: SignalR as the Real-Time Communication Transport

* **Status:** Accepted
* **Date:** 2026-06-13
* **Context/Problem Statement:** YtGuessWho requires persistent, bidirectional, low-latency communication between the server and all players in a Jam. Every game event — a player joining, a phase changing, a round ending — must be pushed from the server to all connected clients immediately and reliably. The server must also receive messages from clients (song submissions, guesses, phase advance requests) without polling. A transport technology must be chosen that fits the .NET ecosystem, supports group broadcasting natively, and keeps infrastructure complexity low.

---

## Options Considered

### Option 1: Plain WebSockets (`System.Net.WebSockets`)

* **Description:** Manage raw WebSocket connections directly using the ASP.NET Core low-level WebSocket API. All framing, connection tracking, and broadcasting are written by hand.
* **Pros:**
  * Zero abstraction overhead — full control over the wire protocol.
  * No third-party dependencies beyond the .NET runtime.
* **Cons:**
  * No built-in concept of groups or rooms — broadcasting to all players in a Jam must be implemented from scratch.
  * No automatic fallback transport; clients that cannot use WebSockets (e.g., certain proxies) are simply unsupported.
  * Connection lifecycle management (reconnects, heartbeats, clean disconnects) must be coded manually.
  * Significantly more boilerplate for features that SignalR provides out of the box.

---

### Option 2: gRPC Bidirectional Streaming

* **Description:** Use gRPC with server-streaming or bidirectional-streaming RPCs over HTTP/2 to push events to clients and receive commands from them.
* **Pros:**
  * Strongly-typed Protobuf contracts; excellent for service-to-service communication.
  * HTTP/2 multiplexing is efficient for many concurrent streams.
* **Cons:**
  * Browser support requires gRPC-Web or a transcoding proxy — significant added infrastructure.
  * Not designed around the broadcast/group model that a multi-player game room demands.
  * Contract changes require recompiling Protobuf schemas and regenerating client stubs — poor fit for a separately deployed web client.
  * Higher operational complexity for a V1 product.

---

### Option 3: ASP.NET Core SignalR

* **Description:** Use ASP.NET Core SignalR — the first-party, production-grade real-time library in the .NET ecosystem. SignalR abstracts the transport (preferring WebSockets, falling back to Server-Sent Events or long polling) and exposes a Hub model where the server can call strongly-typed methods on individual clients or groups.
* **Pros:**
  * **Native group broadcasting:** `Clients.Group(jamCode)` maps directly to the Jam/Player model — no custom room registry needed.
  * **Strongly-typed Hub clients:** `IGameHubClient` interface gives compile-time safety on all server → client event names and payloads.
  * **Automatic transport negotiation:** WebSockets preferred; graceful fallback means no client connectivity surprises.
  * **First-party .NET support:** ships with `Microsoft.AspNetCore`; zero additional infrastructure to operate.
  * **Connection lifecycle hooks:** `OnConnectedAsync` / `OnDisconnectedAsync` integrate cleanly with the `PlayerJoined` / `PlayerLeft` domain events.
  * **Scale-out ready:** a Redis backplane can be added in a future milestone with a single NuGet package and one line of DI registration — no architectural change required.
  * Fits naturally into the Infrastructure layer as defined in ADR-001; the Hub is purely a delivery mechanism with no domain logic.
* **Cons:**
  * Couples the real-time transport to the .NET/ASP.NET Core stack (acceptable given the server is already .NET).
  * The JavaScript client library must be bundled in the web client (`@microsoft/signalr` npm package).
  * Stateful connection model means horizontal scaling requires the Redis backplane (deferred, not a V1 constraint).

---

## Decision Outcome

* **Chosen Option:** Option 3 — ASP.NET Core SignalR.
* **Justification:** SignalR is the idiomatic, battle-tested answer for real-time communication in .NET. Its group model is a natural fit for the Jam construct; its strongly-typed Hub client interface enforces the server→client event contract at compile time; and its transport negotiation removes an entire class of client connectivity problems. All alternatives require significant hand-rolled infrastructure to reach feature parity with what SignalR provides out of the box.
* **Consequences:**
  * **Gained:** Fast, safe, group-aware real-time transport with minimal boilerplate; compile-time contract enforcement via `IGameHubClient`; a clear extension path to Redis scale-out.
  * **Accepted cost:** The web client must include the `@microsoft/signalr` npm package. The server's real-time capability is tied to the ASP.NET Core hosting model.
  * **Placement:** `GameHub` and `IGameHubClient` live in `YtGuessWho.Infrastructure`, consistent with the Clean Architecture layer boundaries defined in ADR-001. No SignalR types cross into `Application` or `Domain`.
  * **Follow-up:** A Redis backplane (`Microsoft.AspNetCore.SignalR.StackExchangeRedis`) should be evaluated when horizontal scaling becomes a requirement.

