# C# and .NET Coding Standards

## 1. Purpose & Scope

- **Why this guideline exists:** Inconsistent style, misuse of language features, and weak defensive coding practices are the leading sources of maintainability debt and latent bugs in C# codebases. This document establishes a single, unambiguous standard so that every file in this repository looks and behaves like it was written by one person.
- **Who it applies to:** Every developer writing C# for this project, across all server-side layers — `YtGuessWho.Domain`, `YtGuessWho.Application`, `YtGuessWho.Infrastructure`, and `YtGuessWho.Api`. Rules apply equally to production code and test code unless a rule explicitly states otherwise.

---

## 2. Standards & Rules

Rules are grouped by concern. Each rule is stated as an imperative that can be definitively checked on any piece of code.

---

### 2.1 — Project & File Structure

1. **Use file-scoped namespaces.** Every `.cs` file must use `namespace Foo.Bar;` (terminated with a semicolon), not the block-scoped `namespace Foo.Bar { }` form. The entire file body is the namespace scope.
2. **One type per file.** Each public or internal type lives in its own file. Nested types are the only permitted exception.
3. **File name must match type name.** A file declaring `public sealed class JamRepository` must be named `JamRepository.cs`.
4. **Use `global using` directives only in a dedicated file.** If global usings are needed, place them exclusively in `GlobalUsings.cs` at the project root. Do not scatter `global using` across files.
5. **Enable nullable reference types.** All projects must have `<Nullable>enable</Nullable>` in their `.csproj`. This is already enforced — do not disable it.
6. **Enable implicit usings.** All projects must have `<ImplicitUsings>enable</ImplicitUsings>`. Do not add `using System;`, `using System.Collections.Generic;`, or other BCL usings that are covered by implicit usings.

---

### 2.2 — Naming Conventions

Follow Microsoft's standard naming conventions without exception.

| Construct | Convention | Example |
|---|---|---|
| Classes, structs, records, interfaces | `PascalCase` | `JamSession`, `IPlayerRepository` |
| Methods | `PascalCase` | `StartRound()`, `GetByIdAsync()` |
| Properties | `PascalCase` | `SessionId`, `IsActive` |
| Events | `PascalCase` | `RoundStarted`, `PlayerJoined` |
| Constants (`const`, `static readonly`) | `PascalCase` | `MaxPlayers`, `DefaultTimeout` |
| Private fields | `_camelCase` (underscore prefix) | `_repository`, `_logger` |
| Local variables and parameters | `camelCase` | `sessionId`, `cancellationToken` |
| Type parameters | `T` prefix + `PascalCase` | `TEntity`, `TResult` |
| Interfaces | `I` prefix + `PascalCase` | `IJamRepository`, `IEventDispatcher` |
| Async methods | `Async` suffix | `GetJamAsync()`, `SaveAsync()` |
| Test methods | `[Method]_[Scenario]_[ExpectedOutcome]` | `StartRound_WhenNoSubmissions_Throws` |

7. **Do not use abbreviations** unless they are universally understood acronyms (`Id`, `Url`, `Http`, `Dto`). Prefer `cancellationToken` over `ct`, `repository` over `repo`.
8. **Boolean members must read as a predicate.** Use `IsActive`, `HasStarted`, `CanSubmit` — never `Active`, `Started`, `Submit`.

---

### 2.3 — Type Design

9. **Apply `sealed` to all leaf classes by default.** A class that is not explicitly designed as a base class must be `sealed`. Remove `sealed` only when inheritance is a deliberate design decision and documented as such.
10. **Apply `internal` to all types not part of the public API.** Types that exist to serve a single layer or module must be `internal`. Only types that cross layer boundaries (interfaces in `Application`, domain objects) should be `public`.
11. **Prefer `record` for value objects and DTOs.** Any type whose identity is defined by its data — not by reference — must be a `record` or `record struct`. This includes: API request/response payloads, domain value objects, SignalR message payloads, and query results. Domain entities and aggregates are identity-based (reference semantics) and must remain classes — see §2.15.
12. **Prefer `record struct` for small, stack-allocated value types.** Use `record struct` when the type is small (2–4 fields), immutable, and performance-sensitive. Use `record` (class-backed) for larger or heap-allocated value types.
13. **Prefer auto-implemented properties.** Do not declare a private backing field and a manual getter/setter pair when an auto-implemented property suffices. Use `{ get; init; }` for immutable members and `{ get; private set; }` for members that may only be mutated by the owning type.
14. **Prefer `init`-only setters for immutable types.** Objects that should not change after construction must use `init` setters, not `set`. This applies to all `record` types and any DTO or value object.
15. **Expose only what is currently required — nothing more.** Every member's visibility must be the most restrictive level that satisfies its present callers. Do not broaden a setter, method, or type to `internal` or `public` in anticipation of future tickets; widen it when the ticket that needs it is being implemented. A member that is `private` today and is never called from outside the type must stay `private`. Preemptive visibility widening is a guideline violation and will be rejected in code review.

---

### 2.4 — Documentation

16. **All public members must have XML doc comments.** This applies to: classes, interfaces, records, structs, enums, methods, properties, events, and constructors. Internal members are encouraged but not enforced — the rule is mandatory only for `public`.
17. **XML doc comments must be meaningful.** A comment that merely restates the member name (e.g., `/// <summary>Gets the Id.</summary>` on a property named `Id`) provides no value. Comments must describe intent, constraints, valid values, and side effects where relevant.
18. **Document thrown exceptions in XML.** Every `throw` statement or documented invariant violation must be accompanied by a `<exception cref="...">` tag on the declaring method explaining the condition.

---

### 2.5 — Null Handling

19. **Prefer `is null` and `is not null` over `== null` and `!= null`.** Pattern-matching null checks are the standard form.
20. **Use the null-conditional operator `?.`** for member access on potentially-null references. Chain `?.` with `??` to provide a fallback. Never write a manual null guard for simple member access that `?.` can express.
21. **Use the null-coalescing assignment operator `??=`** to lazily initialise a field or variable in a single expression.
22. **Never suppress nullable warnings with `!` (null-forgiving operator) without a comment.** Every use of `!` must be accompanied by a `// justification` inline comment explaining why the reference is guaranteed non-null at that point.
23. **Initialise all non-nullable reference type fields in the constructor or via property initialisers.** Do not rely on the null-forgiving operator to silence warnings that arise from uninitialised fields.

---

### 2.6 — Control Flow & Expressions

24. **Use braces for all control flow statements.** Every `if`, `else`, `for`, `foreach`, `while`, `do`, and `using` statement must use braces, even for single-line bodies. Braceless control flow is forbidden.
25. **Avoid excessive nesting.** Maximum two levels of nested control flow inside a method body. When nesting would exceed two levels, extract a private method or use guard clauses (early returns) to flatten the logic.
26. **Use guard clauses for precondition checks.** Return early or throw early at the top of a method to eliminate the `else` branch of a precondition check. Do not wrap the entire method body in an `if` block.
27. **Prefer the conditional operator `? :` for simple if/else assignments.** When an `if/else` block does nothing other than assign one of two values to a variable, replace it with a conditional expression. Do not use `? :` for complex, multi-line logic — that must remain an `if/else` block.
28. **Prefer `switch` expressions over `switch` statements.** When switching to produce a value, always use a `switch` expression. Use a `switch` statement only when the branches produce side effects rather than values.
29. **Ensure `switch` expressions are exhaustive.** Every `switch` expression must either cover all cases explicitly or include a discard arm (`_ =>`) that throws a `DomainException` or `InvalidOperationException` with a descriptive message. Silent fall-through is forbidden.

---

### 2.7 — Pattern Matching

30. **Prefer pattern matching over type casting.** Use `if (x is SomeType t)` instead of `if (x is SomeType) { var t = (SomeType)x; ... }`.
31. **Use property patterns to test multiple conditions on an object simultaneously.** `if (order is { Status: OrderStatus.Open, ItemCount: > 0 })` is preferred over nested `if` chains accessing the same object.
32. **Use relational and logical patterns in `switch` expressions.** Prefer `>= 10 and <= 20` over explicit range checks in separate `if` branches.
33. **Use list patterns where appropriate.** When branching on the shape or content of a collection, prefer list patterns (`[first, second, ..]`) over index-based element access inside conditionals.

---

### 2.8 — String Handling

34. **Prefer string interpolation over `string.Format` and concatenation.** Use `$"Hello, {name}"` for dynamic strings.
35. **Prefer simplified string interpolation.** Avoid redundant `.ToString()` calls inside interpolation holes — the compiler inserts them. `$"{value}"` not `$"{value.ToString()}"`.
36. **Use raw string literals for multi-line or escape-heavy strings.** Triple-quoted `"""` raw string literals are preferred over escape sequences for JSON snippets, regex patterns, and multi-line text.
37. **Use `string.IsNullOrWhiteSpace` for user-input validation.** Never use `== ""` or `string.IsNullOrEmpty` when the intent is to reject blank/whitespace input.
38. **Use `nameof()` instead of hard-coded member name strings.** Whenever a string must represent the name of a type, member, or parameter (e.g., argument exception messages, logging, serialisation), use `nameof()` to keep it refactor-safe.

---

### 2.9 — Async & Concurrency

39. **Apply `CancellationToken` to every `async` method.** All methods bearing the `async` keyword or returning `Task` / `ValueTask` must accept a `CancellationToken cancellationToken` parameter. Name the parameter `cancellationToken` exactly — no abbreviations.
40. **Propagate `CancellationToken` to every downstream async call.** Never discard a `CancellationToken` by passing `CancellationToken.None` or omitting the parameter where one is accepted.
41. **Use `async`/`await` throughout.** Do not return a `Task` directly from a method that calls an async method, unless the method is a trivial one-liner with no `using`, `try/catch`, or state that depends on completion. Unwrapped tasks silently swallow exceptions and prevent proper stack trace capture.
42. **Never use `async void`.** Async methods must return `Task` or `ValueTask`. The only permitted exception is event handlers (e.g., ASP.NET Core SignalR `OnConnectedAsync`), where the framework signature mandates `Task`.
43. **Use `ValueTask` for hot-path async methods that frequently complete synchronously.** For all other methods, prefer `Task`. Never expose `ValueTask` results to multiple awaiters.
44. **Use `ConcurrentDictionary<TKey, TValue>` for in-memory shared state accessed from multiple threads.** Standard `Dictionary<TKey, TValue>` is not thread-safe. Any in-memory repository or cache that may be accessed concurrently (e.g., `InMemoryJamRepository`) must use `ConcurrentDictionary`. Prefer `GetOrAdd`, `AddOrUpdate`, and `TryGetValue` over equivalent manual check-and-set patterns.
45. **Do not use `lock` when `ConcurrentDictionary` operations suffice.** `lock` introduces blocking and is harder to reason about. It is permitted only when atomicity across multiple dictionary operations is required and cannot be achieved with `ConcurrentDictionary`'s atomic methods.

---

### 2.10 — Exceptions & Error Handling

46. **Throw domain exceptions for all invariant violations.** Never throw a generic `Exception`, `ApplicationException`, or `InvalidOperationException` for a business rule violation. All domain exceptions must be defined in `YtGuessWho.Domain` and must carry meaningful names that belong to the ubiquitous language.
47. **Domain exceptions must inherit from a base domain exception.** Define a `DomainException : Exception` base class in `YtGuessWho.Domain`. All other domain exceptions inherit from it. This allows callers and middleware to catch the entire family at once.
48. **Never catch `Exception` silently.** Every `catch (Exception)` block must either rethrow (`throw;`), wrap with additional context, or log at `Error` level with the full exception before handling. Swallowing exceptions is forbidden.
49. **Use `ArgumentNullException.ThrowIfNull()` and `ArgumentOutOfRangeException.ThrowIfNegative()`** (and other BCL throw helpers) for parameter validation in constructors and public methods. Do not write manual `if (x is null) throw new ArgumentNullException(...)` when a BCL helper exists.
50. **Do not use exceptions for flow control.** Exceptions signal unexpected, invariant-violating conditions. Predictable negative outcomes (e.g., "player not found") must be represented with discriminated results or nullable returns, not by throwing and catching.

---

### 2.11 — LINQ & Delegates

51. **One-line lambda expressions are reserved for single-statement LINQ chains.** A lambda used as a LINQ predicate, selector, or key extractor may be written inline without braces only if it is a single expression. Any lambda body spanning more than one logical operation must use braces and a block body.
52. **Prefer method syntax over query syntax for LINQ.** `collection.Where(...).Select(...)` is preferred over `from x in collection where ... select ...`. Query syntax is permitted for complex joins where method syntax becomes unreadable, but must be agreed upon in code review.
53. **Never use LINQ inside tight loops for performance-sensitive code paths.** LINQ allocates enumerators and closures. For hot paths (e.g., processing a SignalR message for every active participant), use `foreach` with direct collection access.
54. **Do not chain more than four LINQ operators without extracting a named helper.** Long, anonymous LINQ pipelines are hard to debug. Break complex pipelines into named methods or named variables that state the intent of each transformation step.

---

### 2.12 — Dependency Injection & Lifetime

55. **Use constructor injection exclusively.** Service locator (`IServiceProvider.GetService<T>()`) is forbidden in application and domain code. Infrastructure bootstrapping code (DI modules) is the only permitted context for resolving directly from the container.
56. **Inject interfaces, never concrete types.** Constructor parameters must declare the interface type, not the implementation class. This applies across all layers.
57. **Respect service lifetimes.** Never inject a `Scoped` or `Transient` service into a `Singleton`. Register services in the Autofac module appropriate to their layer.

---

### 2.13 — Modern C# Features (C# 12 / 13 / .NET 10)

58. **Use primary constructors for types whose constructor body only assigns fields.** When a constructor does nothing but assign parameters to fields, use a primary constructor. Do not use primary constructors when the constructor body contains logic beyond assignment.
59. **Use collection expressions `[...]` for collection initialisation.** `List<string> names = ["Alice", "Bob"];` is preferred over `new List<string> { "Alice", "Bob" }`. Applies to arrays, lists, spans, and any BCL collection type that supports collection expression initialisation.
60. **Use `using` declarations (not `using` statements) for disposable resources.** `using var reader = ...;` is preferred over the block-scoped `using (var reader = ...) { }` form, unless the disposal scope must end before the enclosing scope.
61. **Prefer `is` type patterns over `as` + null check.** `if (x is MyType t)` is preferred over `var t = x as MyType; if (t != null)`.
62. **Use `required` properties for mandatory DTO members.** Record and class properties that must always be set by the caller must be marked `required`. This shifts the validation to the compiler rather than to runtime checks.
63. **Use `params ReadOnlySpan<T>` for variadic helpers where applicable.** Prefer the span-based `params` overload (available from C# 13) over array-based `params` for zero-allocation variadic parameters in performance-sensitive helpers.

---

### 2.14 — SOLID Principles

SOLID is a non-optional engineering constraint, not an aspirational goal. All five principles apply at every layer. Rules 64–71 focus on the two principles most commonly violated in this codebase — SRP and ISP — with the remaining three stated as binding baselines.

#### Single Responsibility Principle (SRP)

64. **Every class has exactly one reason to change.** Before implementing new functionality inside an existing class, state in plain language that class's current single responsibility. If the new functionality belongs to a different responsibility, create a new type. Never expand a class's scope to avoid writing a new file.

65. **Reassess responsibility on every modification.** Any PR that modifies an existing class must include a short explicit justification — either confirming the change stays within the class's existing single responsibility, or documenting the split that was made. This is a required reviewer check, not optional.

66. **Separate orchestration from validation.** A service class that both validates inputs and coordinates downstream dependencies has two responsibilities and must be split. Structural input validation belongs in value objects or dedicated guard helpers. Business-rule validation belongs in the Domain layer. Orchestration belongs in the Application service.

#### Interface Segregation Principle (ISP)

67. **Interfaces are sized by their consumer, not their implementor.** When designing or modifying an interface, ask: "Does every current consumer of this interface call every method on it?" If the answer is no, the interface must be split before the PR merges.

68. **Never append a method to an existing interface to avoid creating a new one.** When a new feature requires new capabilities from a dependency, declare a new focused interface and inject it separately. The existing interface must remain unchanged. Composition at DI registration level is the correct place to assemble capabilities.

69. **An interface that serves multiple distinct caller types must be split.** For example, an `IJamService` that contains both real-time hub use-cases and background batch operations serves two different callers. It must be broken into `IJamHubService` and `IJamBatchService`. Each caller injects only the interface it needs.

#### Open/Closed Principle (OCP)

70. **Extend behaviour through composition, not modification.** When new behaviour is needed in an existing feature, introduce a new type (decorator, new service, strategy) and wire it via DI rather than modifying the original class. Modification introduces regression risk in existing callers; composition does not.

#### Liskov Substitution Principle (LSP)

71. **Every implementation must be fully substitutable for its interface.** An implementation that throws `NotImplementedException`, silently ignores a parameter, or only functions under preconditions not stated on the interface violates LSP and is forbidden. If an implementation cannot honour the full contract, apply ISP first and split the interface.

> The **Dependency Inversion Principle** (DIP) is already covered by rules 55 and 56 — inject interfaces, never concrete types.

---

### 2.15 — Data and Logic Separation

Domain types describe **what data looks like**. Dedicated companion files describe **what can be done with that data**. This separation makes it immediately clear whether any given type is a data structure or a behaviour holder, and prevents aggregates from accumulating mixed concerns as features grow.

72. **Entities and aggregates are data structures.** A domain entity or aggregate must contain only: field declarations, auto-implemented properties, `init`-only or `private set` setters, a private or internal constructor with parameter-level null validation (`ArgumentNullException.ThrowIfNull` only), and `static` factory methods. Instance methods carrying business logic are not permitted on these types.

73. **Static factory methods are permitted on the data class.** A `static` method that constructs an instance and enforces creation-time invariants (e.g., `Jam.CreateNew(...)`, `JamCode.Generate()`) may live on the class itself. It is structurally equivalent to a static helper function and does not pollute the instance API.

74. **Instance-level business logic lives in extension methods.** Any operation that takes a domain entity or aggregate as its subject and applies a business rule must be declared as a `static` extension method in a dedicated companion file within the same project (e.g., `JamExtensions.cs`). This keeps domain logic co-located with its data types without coupling the two in a single class.

75. **Value objects validate structure only.** A value object's constructor may reject structurally malformed data (e.g., a `JamCode` that rejects strings shorter than six characters). It must not contain methods applying cross-entity business logic. Any behaviour derived from a value object belongs in an extension method.

76. **Records, DTOs, and snapshots carry data only.** Any `record` or DTO used across layers (e.g., `PlayerSnapshot`, `LeaveJamResult`) must expose only properties — no methods, no computed properties derived from business rules. Transformation and projection logic belongs in the layer that produces the mapped result.

77. **All extension method classes live in an `Extensions/` directory within their project.** Every `static` class that exists solely to hold extension methods must be placed in an `Extensions/` folder at the root of the project it belongs to, regardless of which type it extends. The file name must follow the pattern `<SubjectType>Extensions.cs` (e.g., `JamExtensions.cs`). Extension classes must not be co-located with the data classes they extend. This keeps the data vs. logic separation visible at the file-system level and makes extension classes trivially discoverable across all projects.

---

## 3. Rationale

- **`sealed` by default:** Unintended inheritance is a common source of fragile base class problems. Sealing by default forces inheritance to be a deliberate design decision, not an accident. It also enables JIT devirtualisation optimisations.
- **`internal` by default:** Reducing the public surface area of each layer prevents accidental cross-layer coupling. The compiler enforces the boundary rather than relying on convention and discipline alone.
- **`record` for value objects and DTOs:** Records provide structural equality, non-destructive mutation via `with`, and concise declaration syntax — all desirable properties for immutable domain objects and API payloads. Using a class where a record suffices is unnecessary complexity. Note: entities and aggregates have reference-based identity and must remain classes, even though they follow the same data-oriented discipline enforced by §2.15.
- **CancellationToken everywhere:** In a real-time game with concurrent connections, the ability to cancel in-flight async operations is critical for resource management when a player disconnects. Omitting `CancellationToken` from an async method means the caller can never cancel it, leaking resources and causing degraded behaviour under load.
- **Domain exceptions, never generic exceptions:** Generic exceptions cannot be caught selectively at API middleware level. A `DomainException` family allows the API layer to map business rule violations to meaningful HTTP status codes (422 Unprocessable Entity) while letting unexpected exceptions surface as 500s — without the caller needing to inspect messages.
- **Guard clauses / no excessive nesting:** Deeply nested code has exponentially higher cognitive load. Guard clauses express preconditions directly and allow the reader to skip them mentally once they pass, leaving the happy path unindented and easy to follow.
- **`is null` over `== null`:** `== null` can be overloaded by custom types; `is null` always performs a true reference null check. This distinction matters in generic code and when working with value-type proxies.
- **Braces for all control flow:** The most common source of single-line control flow bugs is a subsequent developer adding a second statement and not noticing that only the first was guarded. Mandatory braces eliminate this class of bug entirely.
- **`ConcurrentDictionary` for in-memory state:** The in-memory repositories in this project are Singleton services that serve concurrent SignalR connections. Standard `Dictionary` under concurrent access produces silent data corruption, not an exception. `ConcurrentDictionary` is the minimum safe baseline.
- **SOLID as a hard constraint:** SOLID violations are the most reliable predictor of long-term maintainability debt. ISP violations silently couple callers to capabilities they do not use, making interfaces impossible to mock selectively and hard to evolve without breaking unrelated callers. SRP violations turn well-intentioned service classes into dependency magnets that resist testing. Paying the split cost at authoring time is strictly cheaper than un-growing an interface or class after consumers have accumulated. Treating SOLID as a mandatory constraint — not a best-effort aspiration — keeps the codebase navigable as features grow.
- **Data and logic separation:** An entity that holds state AND applies business logic via instance methods has two reasons to change: when its state shape evolves, and when its business rules change. Separating them into a data class and a companion extension class means each file has exactly one reason to change (SRP applied at the file level). Placing all extension classes in a dedicated `Extensions/` directory within each project makes the separation visible in the file system — a developer opening the project knows immediately where to find all business logic, and where to find all data shapes, without reading any code. Extension methods are discovered through the same autocomplete workflow as instance methods, with zero ambiguity about which file owns them.

---

## 4. Examples

### File-scoped namespace, sealed, internal, XML doc, record DTO

```csharp
// ✅ Correct
namespace YtGuessWho.Application.Jams;

/// <summary>Result returned after a Jam is successfully created.</summary>
/// <param name="JamId">The unique identifier assigned to the new Jam.</param>
public sealed record CreateJamResult(Guid JamId);

// ❌ Wrong — block namespace, class instead of record, missing XML doc, not sealed
namespace YtGuessWho.Application.Jams
{
    public class CreateJamResult
    {
        public Guid JamId { get; set; }
    }
}
```

---

### Null handling

```csharp
// ✅ Correct
if (player is null) throw new ArgumentNullException(nameof(player));
var name = player?.DisplayName ?? "Anonymous";
_cache ??= new ConcurrentDictionary<Guid, Jam>();

// ❌ Wrong
if (player == null) throw new ArgumentNullException("player");
var name = player != null ? player.DisplayName : "Anonymous";
if (_cache == null) _cache = new ConcurrentDictionary<Guid, Jam>();
```

---

### Guard clauses — avoid excessive nesting

Guard clauses apply everywhere a method validates preconditions. For domain entities and aggregates, the method must be an extension method per §2.15 — the guard clause pattern itself is identical regardless of context.

```csharp
// ✅ Correct — guard clauses, flat happy path
// This is in JamExtensions.cs (extension method — see §2.15)
public static void AddPlayer(this Jam jam, Player player)
{
    ArgumentNullException.ThrowIfNull(jam);
    ArgumentNullException.ThrowIfNull(player);

    if (jam.Players.Count >= MaxPlayers)
        throw new JamFullException(jam.JamCode);

    if (jam.Players.Any(p => p.Id == player.Id))
        throw new DuplicatePlayerException(player.Id);

    jam.InternalAddPlayer(player); // calls the entity's package-internal mutator
}

// ❌ Wrong — nested, hard to read
public static void AddPlayer(this Jam jam, Player player)
{
    if (jam is not null)
    {
        if (player is not null)
        {
            if (jam.Players.Count < MaxPlayers)
            {
                if (!jam.Players.Any(p => p.Id == player.Id))
                {
                    jam.InternalAddPlayer(player);
                }
            }
        }
    }
}
```

---

### Braces for all control flow

```csharp
// ✅ Correct
if (round.IsComplete)
{
    AdvanceToNextRound();
}

// ❌ Wrong
if (round.IsComplete)
    AdvanceToNextRound();
```

---

### switch expression over switch statement

```csharp
// ✅ Correct
var label = phase switch
{
    GamePhase.Lobby    => "Waiting for players",
    GamePhase.Active   => "Round in progress",
    GamePhase.Finished => "Game over",
    _                  => throw new InvalidOperationException($"Unhandled phase: {phase}")
};

// ❌ Wrong
string label;
switch (phase)
{
    case GamePhase.Lobby:
        label = "Waiting for players";
        break;
    // ...
}
```

---

### Conditional operator for simple assignments

```csharp
// ✅ Correct
var display = player.IsGuest ? "Guest" : player.DisplayName;

// ❌ Wrong — verbose for a simple two-branch assignment
string display;
if (player.IsGuest)
    display = "Guest";
else
    display = player.DisplayName;
```

---

### Lambda / delegate with braces

```csharp
// ✅ Correct — single-expression LINQ, no braces needed
var active = players.Where(p => p.IsActive).ToList();

// ✅ Correct — multi-statement delegate uses braces
_timer.Elapsed += (_, _) =>
{
    _logger.LogInformation("Timer elapsed");
    ProcessNextRound();
};

// ❌ Wrong — multi-statement lambda without braces is not allowed
_timer.Elapsed += (_, _) => _logger.LogInformation("Timer elapsed");  // fine if single statement, wrong if more follow
```

---

### CancellationToken on async methods

```csharp
// ✅ Correct
public async Task<Jam> GetByIdAsync(Guid id, CancellationToken cancellationToken)
{
    return await _store.FindAsync(id, cancellationToken);
}

// ❌ Wrong — missing CancellationToken
public async Task<Jam> GetByIdAsync(Guid id)
{
    return await _store.FindAsync(id);
}
```

---

### Domain exceptions

```csharp
// ✅ Correct — domain exception defined in Domain layer
if (_phase is not GamePhase.Lobby)
    throw new JamAlreadyStartedException(Id);

// ❌ Wrong — generic exception leaks no domain meaning
if (_phase is not GamePhase.Lobby)
    throw new InvalidOperationException("Jam has already started.");
```

---

### Pattern matching — property patterns and `is` check

```csharp
// ✅ Correct
if (submission is { PlayerId: var id, SongUrl: not null })
    Process(id, submission.SongUrl);

if (result is ErrorResult { Code: 404 })
    return NotFound();

// ❌ Wrong
if (submission != null && submission.SongUrl != null)
    Process(submission.PlayerId, submission.SongUrl);
```

---

### Collection expressions (C# 12+)

```csharp
// ✅ Correct
string[] phases = ["Lobby", "Active", "Finished"];
List<Guid> empty = [];

// ❌ Wrong
string[] phases = new string[] { "Lobby", "Active", "Finished" };
List<Guid> empty = new List<Guid>();
```

---

### SOLID — Interface Segregation (§2.14)

```csharp
// ❌ Wrong — fat interface; GameHub uses CreateJam/JoinJam/LeaveJam,
// but a hypothetical background cleanup job only needs PurgeExpiredJams.
// Both callers are forced to depend on the entire surface.
public interface IJamService
{
    Task<string> CreateJam(CreateJamCommand command, CancellationToken cancellationToken = default);
    Task JoinJam(JoinJamCommand command, CancellationToken cancellationToken = default);
    Task<LeaveJamResult> LeaveJam(LeaveJamCommand command, CancellationToken cancellationToken = default);
    Task PurgeExpiredJams(CancellationToken cancellationToken = default); // ← only the cleanup job needs this
}

// ✅ Correct — interfaces split by consumer; each caller injects only what it uses
public interface IJamService          // consumed by GameHub
{
    Task<string> CreateJam(CreateJamCommand command, CancellationToken cancellationToken = default);
    Task JoinJam(JoinJamCommand command, CancellationToken cancellationToken = default);
    Task<LeaveJamResult> LeaveJam(LeaveJamCommand command, CancellationToken cancellationToken = default);
}

public interface IJamMaintenanceService  // consumed by the cleanup job
{
    Task PurgeExpiredJams(CancellationToken cancellationToken = default);
}

// JamService implements both — that is fine; one implementor, two consumers,
// two interfaces, zero unnecessary coupling.
internal sealed class JamService : IJamService, IJamMaintenanceService { /* ... */ }
```

---

### Data and Logic Separation (§2.15)

```csharp
// ❌ Wrong — Jam aggregate mixes data structure with business logic as instance methods.
// Two reasons to change: state shape changes OR business rules change.
public sealed class Jam
{
    public JamCode JamCode { get; }
    public IReadOnlyList<Player> Players => _players;
    private readonly List<Player> _players;

    public void AddPlayer(string connectionId, string displayName) { /* business logic */ }
    public void RemovePlayer(string connectionId) { /* business logic */ }
}

// ✅ Correct — data class holds state only; logic lives in a companion extension file.

// Jam.cs — data only
public sealed class Jam
{
    public JamCode JamCode { get; }
    public IReadOnlyList<Player> Players => _players;
    private readonly List<Player> _players;

    // Private constructor: data initialisation only, no business rules
    private Jam(JamCode jamCode, Player host) { /* assign fields */ }

    // Static factory: permitted on the class (equivalent to a static helper)
    public static Jam CreateNew(string connectionId, string displayName) { /* ... */ }
}

// JamExtensions.cs — all instance-level business logic for Jam.
// Location: YtGuessWho.Domain/Extensions/JamExtensions.cs
{
    public static void AddPlayer(this Jam jam, string connectionId, string displayName)
    {
        ArgumentNullException.ThrowIfNull(jam);
        // invariant checks + mutation via internal accessor
    }

    public static void RemovePlayer(this Jam jam, string connectionId)
    {
        ArgumentNullException.ThrowIfNull(jam);
        // removal + host-promotion logic
    }
}
```

---

## 5. Enforcement

| Rule | Enforcement mechanism |
|---|---|
| File-scoped namespaces | `.editorconfig` — `csharp_style_namespace_declarations = file_scoped:error` |
| Braces for control flow | `.editorconfig` — `csharp_prefer_braces = true:error` |
| `is null` / `is not null` | `.editorconfig` — `dotnet_style_null_comparison = when_possible:warning` |
| `var` usage / type inference | `.editorconfig` — configured per-team preference; reviewed in PR |
| XML doc on public members | `<GenerateDocumentationFile>true</GenerateDocumentationFile>` in `.csproj` emits CS1591 warnings; treat as errors in CI |
| Nullable reference types | `<Nullable>enable</Nullable>` already active; nullable warnings treated as errors in CI |
| `async void` prohibition | Roslyn analyser `CA2012`, `VSTHRD100` (if `Microsoft.VisualStudio.Threading.Analyzers` is added) |
| Domain exceptions only | Enforced by code review; no automated gate — reviewers must reject `throw new Exception(...)` and `throw new InvalidOperationException(...)` for business rule violations |
| `CancellationToken` presence | Roslyn analyser `CA2016` flags forward-cancellation omissions; enforced at PR review for missing parameters |
| `sealed` / `internal` by default | Enforced by code review; aspirational automation via custom Roslyn analyser in a future ADR |
| Naming conventions | `.editorconfig` naming rules + Roslyn IDE diagnostics; violations shown in Rider as warnings |
| **SRP (§2.14 rules 64–66)** | Code review is the gate. Every PR touching an existing class must include an explicit responsibility justification in the PR description. Reviewers must block PRs that omit this justification or that visibly expand a class's scope beyond a single responsibility. |
| **ISP (§2.14 rules 67–69)** | Code review is the gate. Reviewers must block any PR that appends a method to an existing interface without confirming that all current consumers need the new method. Aspirational: automated via a custom Roslyn analyser in a future ADR. |
| **OCP / LSP / DIP (§2.14 rules 70–71)** | Code review is the gate. OCP and LSP violations are typically surfaced during review of new implementations. DIP is partially automated via rules 55–56 (`inject interfaces, never concrete types`). |
| **Data/logic separation (§2.15 rules 72–77)** | Code review is the gate. Reviewers must block any PR that: (a) adds an instance method with business logic to a domain entity, aggregate, or value object; or (b) places an extension method class outside the `Extensions/` directory of its project. The only additions permitted on data classes are: field declarations, properties, `init`/`private set`/`internal set` setters, constructors with null-guard validation, and `static` factory methods. |
| All other rules | Code review is the primary gate; all reviewers are expected to know this document |

