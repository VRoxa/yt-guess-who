# YtGuessWho — Solution Architecture

> **Status:** Accepted — active reference for all implementation work.
> Architectural decision recorded in [`docs/adr/ADR-001-clean-architecture.md`](./adr/ADR-001-clean-architecture.md).

---

## Guiding Principle

The server follows **Clean Architecture**. Business and domain logic sit at the centre and have **zero dependencies on frameworks, transport, or infrastructure**. Every outer layer (ASP.NET Core, SignalR, in-memory storage) depends inward — never the reverse.

```
┌──────────────────────────────────────────────┐
│                    Api                       │  ← ASP.NET Core host, DI root
│  ┌────────────────────────────────────────┐  │
│  │            Infrastructure              │  │  ← SignalR Hub, repositories
│  │  ┌──────────────────────────────────┐  │  │
│  │  │           Application            │  │  │  ← Use-cases, service interfaces
│  │  │  ┌────────────────────────────┐  │  │  │
│  │  │  │          Domain            │  │  │  │  ← Entities, rules, events
│  │  │  └────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────┘  │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
         dependencies always point inward ➜
```

**The golden rule:** an inner layer never holds a reference to an outer layer. This is enforced by the compiler through project references.

---

## Project Structure

```
YtGuessWho.sln
│
├── src/
│   ├── YtGuessWho.Domain/           ← Layer 1 (innermost)
│   ├── YtGuessWho.Application/      ← Layer 2
│   ├── YtGuessWho.Infrastructure/   ← Layer 3
│   └── YtGuessWho.Api/              ← Layer 4 (outermost)
│
└── tests/
    └── YtGuessWho.Tests/
```

---

## Layer Responsibilities

### Layer 1 — `YtGuessWho.Domain`
**The heart of the system. No NuGet dependencies. No framework references.**

Owns the language of the game as modelled in [`docs/context.md`](./context.md).

| What lives here | Examples |
|-----------------|---------|
| Aggregate roots and entities | `Jam`, `Player`, `Round` |
| Value objects | `YoutubeUrl`, `JamCode` |
| Enumerations | `JamPhase` (`Lobby`, `Submission`, `Playback`, `Results`) |
| Domain events | `PhaseChanged`, `RoundEnded`, `PlayerJoined` |
| Domain exceptions | `InvalidPhaseTransitionException`, `UnauthorizedHostActionException` |
| Business invariants | Enforced inside aggregate methods — never in a service |

**Project references:** none.

---

### Layer 2 — `YtGuessWho.Application`
**Orchestrates use-cases. Knows what to do, not how to do it.**

Defines the interfaces that the outer layers must implement. Depends only on `Domain`.

| What lives here | Examples |
|-----------------|---------|
| Use-case / service interfaces | `IJamService`, `IScoringService` |
| Repository interfaces | `IJamRepository` |
| Application services | `JamService`, `ScoringService` |
| DTOs / command objects | `CreateJamCommand`, `SubmitSongCommand` |

**Project references:** `YtGuessWho.Domain`.

---

### Layer 3 — `YtGuessWho.Infrastructure`
**Knows how to do things. Implements every interface defined in Application.**

Contains all framework-specific and I/O-bound code. Replaceable without touching Domain or Application.

| What lives here | Examples |
|-----------------|---------|
| SignalR Hub | `GameHub` (client-callable methods, strongly-typed `IGameHubClient`) |
| Repository implementations | `InMemoryJamRepository` |
| External adapters | Any future YouTube Data API client |

**Project references:** `YtGuessWho.Application`, `YtGuessWho.Domain`.

---

### Layer 4 — `YtGuessWho.Api`
**The entry point. Composes everything together.**

Responsible for startup, dependency injection registration, middleware, and routing. Contains no business logic.

| What lives here | Examples |
|-----------------|---------|
| ASP.NET Core host | `Program.cs` |
| DI composition | Service registrations, `MapHub<GameHub>` |
| Configuration | `appsettings.json`, environment-specific overrides |
| Dockerfile | Multi-stage build |

**Project references:** `YtGuessWho.Infrastructure`, `YtGuessWho.Application`, `YtGuessWho.Domain`.

---

### `YtGuessWho.Tests`
**Validates domain rules and application logic in complete isolation.**

Tests for Domain and Application layers must never require a running ASP.NET Core host or any infrastructure dependency.

| What lives here | Examples |
|-----------------|---------|
| Domain unit tests | Phase transition rules, scoring logic, invariant enforcement |
| Application unit tests | Use-case handlers with mocked repositories |
| Architecture tests | ArchUnitNET assertions that reject illegal cross-layer references |

**Project references:** `YtGuessWho.Domain`, `YtGuessWho.Application` (infrastructure only via mocks/fakes).

---

## Dependency Matrix

| Project | Domain | Application | Infrastructure | Api |
|---------|:------:|:-----------:|:--------------:|:---:|
| **Domain** | — | ✗ | ✗ | ✗ |
| **Application** | ✔ | — | ✗ | ✗ |
| **Infrastructure** | ✔ | ✔ | — | ✗ |
| **Api** | ✔ | ✔ | ✔ | — |
| **Tests** | ✔ | ✔ | ✗ | ✗ |

✔ = may reference &nbsp; ✗ = must never reference

---

## Invariants & Business Rules Location

All business invariants live **exclusively in the Domain layer** — in companion `static` extension classes co-located with the aggregates they operate on (e.g., `JamExtensions.cs` alongside `Jam.cs`). They are never validated in a service, hub, or controller. Domain aggregates and entities are **pure data classes**; their extension classes own all business logic. See `docs/guidelines/csharp-coding-standards.md §2.15`.

| Rule | Enforced in |
|------|------------|
| A Jam can only advance to the next phase in sequence | `JamExtensions.AdvancePhase()` |
| Only the Host may advance the phase | `JamExtensions.AdvancePhase(requestingPlayerId)` |
| A Submission must be a valid YouTube URL | `YoutubeUrl` value object constructor |
| A Player may only submit one song per Jam | `JamExtensions.SubmitSong()` |
| A Player may only submit one guess per Round | `RoundExtensions.SubmitGuess()` |
| A Jam cannot start Playback without at least one Submission | `JamExtensions.AdvancePhase()` |

---

## Cross-Cutting Concerns

| Concern | Decision |
|---------|---------|
| **Logging** | `ILogger<T>` injected throughout; structured logging on all phase transitions and errors |
| **CORS** | Allowed origins configured in `appsettings.json`; applied in `Api` layer only |
| **Thread safety** | `InMemoryJamRepository` uses `ConcurrentDictionary` to handle concurrent SignalR connections |
| **Validation** | Structural validation (YouTube URL format) in Domain value objects; presence/state validation in Application services |
| **Architecture fitness** | ArchUnitNET tests assert the dependency matrix above on every CI run |

