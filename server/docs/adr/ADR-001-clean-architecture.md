# ADR-001: Adopt Clean Architecture as the Overall Solution Structure

* **Status:** Accepted
* **Date:** 2026-06-13
* **Context/Problem Statement:** The server must coordinate real-time game state (SignalR), enforce domain rules (Jam lifecycle, scoring), and remain infrastructure-agnostic enough to swap transport or storage layers without rewriting business logic. A structural pattern must be chosen early — before any significant code is written — because it shapes how projects, namespaces, dependencies, and tests are organised throughout the entire codebase.

---

## Options Considered

### Option 1: Flat Single-Project Structure

* **Description:** All code lives inside `YtGuessWho.Application` — SignalR hubs, domain logic, and infrastructure wired directly together in one project.
* **Pros:**
  * Fastest to bootstrap; zero cross-project wiring.
  * No ceremony for a small team or prototype.
* **Cons:**
  * Domain logic becomes entangled with ASP.NET Core and SignalR types from day one.
  * Unit testing requires mocking the entire ASP.NET stack.
  * Growing the codebase compounds coupling — refactoring becomes expensive.
  * Impossible to enforce boundaries via compiler (everything can reference everything).

### Option 2: Layered (N-Tier) Architecture

* **Description:** Classic horizontal layers: Presentation → Application → Domain → Infrastructure. Each layer depends only on the one directly below it.
* **Pros:**
  * Well understood and widely documented.
  * Better separation than a flat structure.
* **Cons:**
  * The dependency direction still allows Infrastructure to leak upward through poor discipline.
  * The "Domain" layer tends to become an anemic data model when application logic drifts into the Application layer.
  * Layers encourage organising by technical concern (Controllers, Services, Repositories) rather than by feature, making navigation harder as complexity grows.

### Option 3: Clean Architecture (Dependency Inversion at Every Boundary)

* **Description:** The domain and application core sit at the centre with **zero outward dependencies**. All infrastructure (SignalR transport, in-memory store, external APIs) lives in the outermost ring and depends inward — never the reverse. Interfaces are defined in the core; implementations live in infrastructure.

  Proposed project layout:

  ```
  YtGuessWho.Domain/           ← Entities, Value Objects, Enums, Domain Events. No framework dependencies.
  YtGuessWho.Application/      ← Use-case handlers, service interfaces, application logic. Depends only on Domain.
  YtGuessWho.Infrastructure/   ← SignalR Hub, in-memory repositories, external service adapters. Depends on Application + Domain.
  YtGuessWho.Api/              ← ASP.NET Core host, DI composition root, middleware. Depends on Infrastructure.
  YtGuessWho.Tests/            ← xUnit tests. Depends on Domain + Application only (no infrastructure required).
  ```

* **Pros:**
  * Domain and application logic are **fully testable without ASP.NET Core or SignalR** — fast, isolated unit tests.
  * Enforced by the compiler: `Domain` cannot reference `Infrastructure` because the project reference simply does not exist.
  * Swapping infrastructure (e.g., replacing in-memory storage with Redis in a future milestone) requires touching only the outermost layer.
  * Aligns naturally with DDD concepts already established in `context.md` (Aggregates, Value Objects, Domain Events).
  * Scales well as new features (scoring, reconnection, spectators) are added as vertical slices without disturbing existing layers.
* **Cons:**
  * More upfront structural ceremony compared to the flat approach.
  * Requires the team to consistently honour dependency rules — tooling (e.g., ArchUnitNET) can automate this check.

---

## Decision Outcome

* **Chosen Option:** Option 3 — Clean Architecture.
* **Justification:** The game domain has real invariants (phase transitions, host-only actions, anonymous round play) that deserve an expressive, framework-free model. The SignalR transport is a delivery mechanism — not the core. Clean Architecture makes that distinction explicit and enforceable. The extra project scaffolding is a one-time cost; the payoff is a test suite and domain model that never need to import `Microsoft.AspNetCore`.
* **Consequences:**
  * **Gained:** Highly testable domain core; infrastructure is replaceable; clear onboarding path — engineers know exactly which project to open for any concern.
  * **Accepted cost:** A few more `.csproj` files and DI wiring at startup. Teams must understand and respect the dependency rule (outer → inner, never inner → outer).
  * **Follow-up:** An architecture fitness function (ArchUnitNET or equivalent) should be added to the test suite to automatically reject illegal cross-layer references as the codebase grows.

