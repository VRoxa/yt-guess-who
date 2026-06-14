# Testing Strategy

## 1. Purpose & Scope

- **Why this guideline exists:** Defines the project-wide testing philosophy, tooling, structure, coverage expectations, and enforcement mechanisms. Without a shared strategy, test quality degrades silently across team growth and time — coverage gaps accumulate, confidence erodes, and regressions go undetected until they reach production.
- **Who it applies to:** Every developer working on this project, regardless of discipline. Rules are separated by **Server** and **Client** where tooling or approach differs. Rules listed under **General** apply equally to both.

---

## 2. Standards & Rules

### General

#### 2.1 — The Testing Pyramid

The project follows the **Testing Pyramid** model. The shape of the pyramid is non-negotiable — it must be reflected in the ratio of tests written at every stage of development.

```
         ▲
        /E\        E2E Tests          — fewest; only for critical cross-boundary flows
       /---\
      / SVC \      Service Tests      — medium; all server-side integration
     /-------\
    /  UNIT   \    Unit Tests         — most; the foundation of every feature
   /___________\
```

| Layer | Scope | Relative quantity |
|---|---|---|
| **Unit Tests** | Smallest testable unit in isolation, all side effects faked | Most |
| **Service Tests** | Full server HTTP stack via in-process host; no real external dependencies | Medium |
| **E2E Tests** | Real browser driving client + server running together | Fewest |

Higher layers are slower, more brittle, and more expensive to maintain. They verify integration and journeys — they do **not** replace unit tests, and must never be written as a substitute for missing unit coverage.

#### 2.2 — Coverage Target

- **Unit test coverage must aim for 100%** across all applicable units on both server and client.
- Coverage below 100% is **only acceptable with an explicit, written justification** at the point of exclusion. A missing justification is a blocking PR review comment.
- The following are **never valid** reasons to exclude coverage:
  - "It's too complex to test" — that is a design signal, not an excuse.
  - "It's tested indirectly by a higher-layer test" — indirect coverage does not count.
  - "It's unlikely to break" — likelihood does not determine value.
- Valid reasons for exclusion include: trivial DI bootstrapping wiring with no logic, auto-generated scaffolding, and platform/framework lifecycle hooks that cannot be invoked outside the real runtime.

#### 2.3 — Test Isolation

- Every test must be fully independent and produce the same result regardless of execution order.
- No shared mutable state between tests.
- Every test sets up all its own dependencies explicitly in the Arrange block.
- Tests must not make real network calls, access the filesystem, or depend on environment-specific configuration.

#### 2.4 — Test Naming

Tests must be named so that a failure message alone tells the reader exactly what broke, under what condition, and what was expected. Vague names like `Test1`, `ItWorks`, or `ShouldReturnTrue` are not acceptable.

- **Server:** `[MethodUnderTest]_[Scenario]_[ExpectedOutcome]`
- **Client:** Natural-language sentence inside the `it()` / `test()` description string, readable as a spec statement.

#### 2.5 — Arrange-Act-Assert Structure

Every test must have three clearly separated blocks. On the server, use explicit `// Arrange`, `// Act`, `// Assert` comments. On the client, the same logical structure applies — group setup, execution, and assertion visually even if comment markers are not used.

---

### SERVER

#### 2.6 — Unit Tests

Unit tests are the primary quality gate for all server-side code. They are **not optional** and are **not a separate step** — they ship with the feature in the same commit.

**Location:** `tests/YtGuessWho.Tests/`  
Mirror the source namespace under a matching folder:

| Source layer | Test folder |
|---|---|
| `YtGuessWho.Domain` | `tests/YtGuessWho.Tests/Domain/` |
| `YtGuessWho.Application` | `tests/YtGuessWho.Tests/Application/` |

**Frameworks & libraries:**

| Package | Version | Role |
|---|---|---|
| `xunit` | 2.9.3 | Test framework and runner |
| `FakeItEasy` | 8.3.0 | Mocking and stubbing of application interfaces |
| `FluentAssertions` | 6.12.0 | Readable, expressive assertion syntax |
| `coverlet.collector` | 6.0.4 | Code coverage collection during `dotnet test` |

**What to test by layer:**

| Layer | What to cover |
|---|---|
| `Domain` | Every aggregate method: valid state transitions, every invariant violation (must throw the correct domain exception type), every edge case in value objects and domain rules. No mocking — Domain has no dependencies. |
| `Application` | Every use-case and service method: happy path, all error paths, all branching conditions. Repositories and external interfaces are mocked with FakeItEasy. Never use real infrastructure implementations in unit tests. |
| `Infrastructure` | Not unit tested directly. Verified by Service Tests (§2.8). |
| `Api` | Not unit tested directly. Verified by Service Tests (§2.8). |

**Dependency matrix constraint:** `YtGuessWho.Tests` may only reference `YtGuessWho.Domain` and `YtGuessWho.Application`. Importing any `Infrastructure`, `Api`, SignalR, ASP.NET Core, or Autofac type into the unit test project is a hard violation.

**Infrastructure-only exception:**  
When a task introduces code exclusively in the `Infrastructure` layer (Hub lifecycle wiring, payload records, DI module registrations) and introduces no new `Domain` or `Application` types, there is nothing in `YtGuessWho.Tests` to reference without violating the dependency matrix. In this case:

- No unit tests are written. This must be declared explicitly in the Delivery Checklist with the reason.
- The task's manual Test Plan is the sole quality gate for that change.
- Do not create an integration test project to work around this — that decision is reserved for the Architect.
- This exception does **not** apply to tasks that also introduce `Domain` or `Application` types — those must always have unit tests.

#### 2.7 — Coverage Reporting (Server)

Run coverage with:

```
dotnet test --collect:"XPlat Code Coverage"
```

`coverlet.collector` is already referenced in `YtGuessWho.Tests.csproj`. Coverage results are output as Cobertura XML and reviewed per-project, not as a global aggregate — a well-tested project must not mask an undertested one.

#### 2.8 — Service Tests (Server Integration)

Service tests verify the server as a cohesive system — from HTTP request to response — using an in-process test host. They run against the real wired-up Application and Infrastructure code with in-memory substitutes for all external dependencies.

**Location:** `tests/YtGuessWho.ServiceTests/` (separate project, to be created when the first service test is written)

**Frameworks & libraries:**

| Package | Role |
|---|---|
| `xunit` | Test framework and runner |
| `Microsoft.AspNetCore.Mvc.Testing` | `WebApplicationFactory<T>` — spins up the full ASP.NET Core pipeline in-process |
| `FluentAssertions` | Assertion syntax |

**What to cover:**

- All API endpoints: correct HTTP status codes, response shapes, and content types.
- Domain exception → HTTP status code mapping (e.g., a domain invariant violation must not surface as a 500).
- SignalR Hub flows: connection lifecycle, message routing, event broadcasting, and disconnect cleanup.
- Cross-layer integration: Application services correctly coordinated with Domain and real Infrastructure implementations backed by in-memory stores.
- Global error handling middleware: unhandled exceptions return consistent error envelopes.

**Rules:**

- Service tests must not duplicate logic already covered by unit tests. They verify that layers connect correctly, not that individual business rules hold.
- In-memory state must be reset between test runs. Use a fresh `WebApplicationFactory` instance per test class or implement a clean-up hook.
- Do not mock `Domain` or `Application` in service tests — the real implementations must run. Only substitute external I/O (database, third-party APIs, clocks).
- Service tests are allowed to reference `Infrastructure` — this is the only test layer where that is permitted.

#### 2.9 — E2E Tests (Server Perspective)

E2E tests for the server are shared with the client E2E layer (§2.12). See that section for tooling and rules. From the server perspective, E2E tests must target only cross-boundary flows that cannot be verified at the service test level — primarily those requiring a real browser WebSocket connection to the SignalR hub.

---

### CLIENT

#### 2.10 — Unit & Component Tests

Client unit tests verify Angular components, services, pipes, guards, and resolvers in isolation. Vitest is the test runner, Angular TestBed provides the component compilation environment, and `@testing-library/angular` is the preferred querying and interaction library.

**Location:** Co-located with source files, following Angular convention — a `*.spec.ts` file adjacent to the file under test (e.g., `session.component.ts` → `session.component.spec.ts`).

**Frameworks & libraries:**

| Package | Role |
|---|---|
| `vitest` | Test runner — already configured via `@angular/build:unit-test` in `angular.json` |
| `jsdom` | DOM environment for Vitest — already in `devDependencies` |
| `Angular TestBed` | Compiles and mounts Angular components in a controlled test environment |
| `@testing-library/angular` | Queries and interactions from the user's perspective (by role, label, text) |
| `@testing-library/user-event` | Realistic user interaction simulation (typing, clicking, focusing) |

**What to cover:**

| Unit | What to cover |
|---|---|
| **Components** | Rendered output given `@Input()` values, user interaction events (click, input, focus), emitted `@Output()` events, conditional rendering (`@if`, `@for`, `*ngIf`), accessibility attributes |
| **Services** | All methods: happy path, error paths, RxJS observable emissions, interaction with injected dependencies (all mocked) |
| **Pipes** | Every transformation rule: valid inputs, boundary values, `null` / `undefined` / empty string handling |
| **Guards & Resolvers** | All branching conditions: access granted, access denied, redirect targets |
| **Reactive Forms** | Validator logic, valid/invalid state transitions, form submission handling |

**Rules:**

- Prefer `@testing-library/angular` queries (`getByRole`, `getByLabelText`, `getByText`, `findByText`) over direct DOM selectors (`querySelector`) or accessing component instance properties. Tests must describe observable user-facing behaviour, not implementation internals.
- Never test Angular framework mechanics. Do not assert that `ngOnInit` was called, that `ChangeDetectorRef.detectChanges()` ran, or that a lifecycle hook executed. Assert on the **outcome** of that lifecycle, not the hook itself.
- Mock all HTTP calls using Angular's `provideHttpClientTesting` / `HttpTestingController`. No real network requests are permitted in unit tests.
- Component tests must configure `TestBed.configureTestingModule` with only the direct dependencies of the component under test. Do not import entire feature modules — this inflates test scope and slows the suite.
- RxJS observables returned by mocked services must use `of()`, `throwError()`, or a `Subject` as appropriate to the scenario being tested. Never rely on timing-based operators without controlling the scheduler.
- Signal-based component inputs and outputs must be tested through the rendered DOM, not by directly reading signal values.

**Running client tests:**

```
pnpm test
```

With coverage:

```
pnpm test -- --coverage
```

#### 2.11 — Coverage Reporting (Client)

Coverage is collected by Vitest's built-in coverage provider (`@vitest/coverage-v8` or `@vitest/coverage-istanbul`). Coverage is measured per Angular module/feature, not as a single global percentage — a well-tested feature must not mask an untested one.

The 100% coverage target applies to: components, services, pipes, guards, resolvers, and utility functions. Auto-generated `app.config.ts` bootstrapping and environment files are excluded.

#### 2.12 — E2E Tests (Client + Server)

E2E tests drive the full application through a real browser against a locally running Angular dev build and server. They are the most expensive tests in the suite and must remain the fewest in number.

**Location:** `tests/e2e/` at the repository root (a separate project, shared between client and server disciplines).

**Framework:** **Playwright** — drives Chromium, Firefox, and WebKit; first-class async support; stable, parallelisable tests; integrates naturally with Angular's async rendering model.

**What to cover (only):**

- The most critical happy-path user journeys that span client rendering, server logic, and real-time SignalR events simultaneously — for example, a full game session from lobby creation through round play to score reveal.
- Flows that require a live browser WebSocket connection to the SignalR hub, which cannot be reliably simulated in service tests.
- Navigation and routing flows that depend on live server-issued session state.

**What NOT to cover:**

- Any scenario already reliably covered by a unit test or service test.
- Negative or error paths — these belong in unit and service tests where they can be isolated and run in milliseconds.
- Styling or visual regression — not in scope for this test layer.

**Rules:**

- Every E2E test must be independent. It must seed its own state and must not rely on state left by a previous test run.
- E2E tests must not call internal APIs or bypass the UI to set up state — if a user journey requires a lobby to exist, the test must create it through the UI.
- E2E tests run in CI as a **separate, non-blocking gate**. Flakiness must not block a merge. Flaky tests must be investigated and fixed or quarantined promptly.
- E2E tests must never be the only test for a given piece of behaviour.

---

## 3. Rationale

- **100% unit coverage target:** The domain invariants and business rules in this project are the core of product value. Gaps in unit coverage are direct risks to game integrity. The 100% target is also a forcing function for clean, testable design — code that resists unit testing is signalling a design problem.
- **Testing pyramid shape:** Higher-layer tests are orders of magnitude slower and more fragile. Over-investing in E2E or service tests while under-investing in unit tests produces a suite that is slow to run, slow to debug, and slow to fix — the opposite of the confidence the suite is meant to provide.
- **WebApplicationFactory for service tests:** Mocking the HTTP boundary in unit tests gives false confidence about serialisation, routing, middleware, and pipeline behaviour. `WebApplicationFactory` runs the real ASP.NET Core pipeline in-process at near-zero overhead — there is no reason to mock what can be run for real.
- **@testing-library/angular:** Tests that query by DOM selectors or access component internals break on every refactor. Tests that query by role, label, and visible text survive refactoring and describe real user-observable behaviour. This makes the test suite more resilient and more useful as living documentation.
- **Vitest over Karma:** Karma is deprecated as of Angular 16 and is unsupported in Angular 21. Vitest is the configured runner for this project, aligns with modern ESM-first tooling, and is already wired via `@angular/build:unit-test` in `angular.json`.
- **Co-located spec files:** Keeps tests adjacent to the code they verify. It is immediately visible when a source file has no corresponding spec file, making coverage gaps obvious without running a report.
- **Playwright for E2E:** Playwright is the current industry standard for browser automation in modern web applications. It supports three browser engines, has robust async/await semantics, produces stable parallelisable tests, and has first-class TypeScript support — all aligned with this project's technology choices.

---

## 4. Examples

### Server — Domain Unit Test

```
// Naming:  StartRound_WhenJamHasNoSubmissions_ThrowsInsufficientSubmissionsException
// Arrange: create a Jam aggregate with zero submissions added
// Act:     call jam.StartRound()
// Assert:  exception of type InsufficientSubmissionsException is thrown
//          no state mutation occurred on the aggregate
```

### Server — Application Unit Test

```
// Naming:  SubmitSongAsync_WhenPlayerAlreadySubmitted_ThrowsDuplicateSubmissionException
// Arrange: mock ISubmissionRepository.ExistsAsync to return true
//          create SubmitSongCommandHandler with the mocked repository
// Act:     call handler.HandleAsync(command)
// Assert:  DuplicateSubmissionException is thrown
//          ISubmissionRepository.SaveAsync was never called (verified via FakeItEasy)
```

### Server — Service Test (HTTP endpoint)

```
// Scenario: creating a Jam returns 201 Created with a Location header
// Arrange:  spin up WebApplicationFactory; ensure in-memory store is empty
// Act:      POST /api/jams with a valid CreateJamRequest payload
// Assert:   response.StatusCode == 201 Created
//           response.Headers.Location points to /api/jams/{newId}
```

### Server — Service Test (domain exception mapping)

```
// Scenario: submitting to a full round returns 422 Unprocessable Entity
// Arrange:  seed a Jam in a state where the round is full
// Act:      POST /api/jams/{id}/submissions
// Assert:   response.StatusCode == 422
//           response body contains a structured error envelope, not a stack trace
```

### Client — Component Unit Test

```
// Describe: ScoreboardComponent
//   Describe: when scores are provided
//     it: renders one row per player
//     it: displays players in descending score order
//   Describe: when scores list is empty
//     it: renders an empty-state message

// Query style (preferred):
// getByRole('row') — not querySelector('tr')
// getByText('0 players') — not component.players.length === 0
```

### Client — Service Unit Test

```
// Describe: SessionService > getSession
//   it: emits a mapped SessionViewModel when the HTTP call succeeds
//   it: propagates the error when the HTTP call returns 404
//   it: maps participantId and displayName from the raw API response

// Arrange: inject HttpTestingController; flush a fixture response
// Act:     subscribe to service.getSession(sessionId)
// Assert:  emitted value matches the expected SessionViewModel shape
```

### Client — E2E Test (Playwright)

```
// Scenario: host creates a lobby and a player joins it
// Step 1:   navigate to home page
// Step 2:   click "Create Game" button
// Step 3:   assert lobby code is displayed
// Step 4:   open a second browser context (player)
// Step 5:   enter lobby code and click "Join"
// Step 6:   assert host's view shows the player in the participant list
// Step 7:   assert player's view shows "Waiting for host to start"
```

---

## 5. Enforcement

| Rule | Enforcement mechanism |
|---|---|
| Server unit test coverage target | `dotnet test --collect:"XPlat Code Coverage"` run in CI; Cobertura report reviewed on every PR |
| Client unit test coverage target | `pnpm test -- --coverage` run in CI; coverage report reviewed on every PR |
| Coverage exclusion must have justification | Absence of a justification comment is a blocking PR review comment |
| Infrastructure-only exception | Must be declared explicitly in the PR description and Delivery Checklist; requires a second developer's acknowledgement |
| Unit tests ship with the feature | PRs that introduce production code without corresponding tests are blocked at code review |
| Service tests pass | Separate CI step; failure blocks merge |
| E2E tests pass | Separate, non-blocking CI step; failures are investigated and triaged but do not block merge on their own |
| `@testing-library/angular` query discipline | Enforced by code review; `eslint-plugin-testing-library` may be added as an automated gate in a future ADR |
| Test naming convention | Enforced by code review; no automated gate — convention is self-documenting through failure messages |

