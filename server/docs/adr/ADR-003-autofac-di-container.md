# ADR-003: Autofac as the Dependency Injection / IoC Container

* **Status:** Accepted
* **Date:** 2026-06-13
* **Context/Problem Statement:** Clean Architecture (ADR-001) relies heavily on interface abstractions and dependency inversion: `Application` defines interfaces, `Infrastructure` implements them, and `Api` composes everything. A DI/IoC container is required to wire these layers together at runtime. The built-in ASP.NET Core `IServiceCollection` container is the default choice in the ecosystem, but it has well-known limitations as composition complexity grows. A container must be chosen that can scale with the project's modular structure without introducing friction or fragility.

---

## Options Considered

### Option 1: ASP.NET Core Built-in Container (`Microsoft.Extensions.DependencyInjection`)

* **Description:** The default container shipped with ASP.NET Core. Registrations are made via `IServiceCollection` in `Program.cs` using `AddSingleton`, `AddScoped`, and `AddTransient`.
* **Pros:**
  * Zero extra dependencies — ships with the runtime.
  * Universally familiar to .NET developers.
  * Sufficient for small, flat composition roots.
* **Cons:**
  * No support for **named or keyed registrations** beyond the basic `AddKeyedSingleton` introduced in .NET 8 (limited, non-fluent).
  * No **module system** — all registrations must live in `Program.cs` or be manually split into extension methods, making cross-layer registration organisation a convention rather than a contract.
  * No **property injection** or **assembly scanning** — every registration must be explicit and hand-maintained.
  * No **decorators** — wrapping a service (e.g., adding logging or caching around `IJamService`) requires manual delegation classes.
  * Composition root grows linearly with the codebase; there is no mechanism to co-locate a layer's registrations with the layer itself.

---

### Option 2: Autofac

* **Description:** A mature, feature-rich IoC container for .NET that integrates with `IServiceCollection` via `Autofac.Extensions.DependencyInjection`. ASP.NET Core uses it as the backing container while all existing `builder.Services` registrations (SignalR, CORS, health checks, etc.) continue to work unchanged.
* **Pros:**
  * **Module system:** Each project (`Domain`, `Application`, `Infrastructure`) can own an `Autofac.Module` that registers its own services. The `Api` layer simply loads the modules — no cross-layer registration knowledge required.
  * **Assembly scanning:** Automatically register all implementations of an interface in a given assembly (e.g., all `IRequestHandler<>` implementations) without maintaining a manual list.
  * **Decorators:** First-class `RegisterDecorator<T>` support — useful for transparently wrapping services with logging, validation, or caching.
  * **Named / keyed registrations:** Resolve multiple implementations of the same interface by name — clean handling of strategy-pattern use-cases.
  * **Lifetime scoping:** Fine-grained control over lifetimes, including `InstancePerMatchingLifetimeScope` for SignalR Hub scopes.
  * **Drop-in integration:** `UseServiceProviderFactory(new AutofacServiceProviderFactory())` is a single line; all existing `IServiceCollection` APIs remain valid.
  * Widely used in production .NET systems; well-maintained; comprehensive documentation.
* **Cons:**
  * Additional NuGet dependency (`Autofac`, `Autofac.Extensions.DependencyInjection`).
  * Developers unfamiliar with Autofac modules need a short onboarding ramp.
  * Slight increase in startup configuration complexity compared to the built-in container.

---

## Decision Outcome

* **Chosen Option:** Option 2 — Autofac.
* **Justification:** The Clean Architecture layer structure demands a modular composition root. Each layer should be self-contained — its registrations should live alongside its code, not be scattered across a single `Program.cs`. Autofac's `Module` system is the idiomatic answer to this requirement. As the codebase grows (scoring strategies, future adapters, potential decorator chains for cross-cutting concerns), the built-in container would require escalating hand-maintenance that Autofac eliminates through scanning and first-class decorator support. The integration cost is a single line at startup and two NuGet packages.
* **Consequences:**
  * **Gained:** Self-contained per-layer registration modules; assembly scanning for convention-based wiring; decorator support for cross-cutting concerns (logging, validation); cleaner, smaller `Program.cs`.
  * **Accepted cost:** Two additional NuGet packages; team members must understand the Autofac `Module` pattern.
  * **Placement:** Each layer exposes one `AutofacModule` class. The `Api` layer loads all modules in `Program.cs`. No layer's module references another layer's module directly — the composition root alone assembles the full graph.
  * **Follow-up:** Enforce via convention that every new service registered in `Infrastructure` or `Application` is added to its layer's module — not to `Program.cs` directly.

---

## Module Structure

```
YtGuessWho.Domain/
└── (no registrations — pure objects, no services)

YtGuessWho.Application/
└── DependencyInjection/
    └── ApplicationModule.cs    ← Registers IJamService, IScoringService, etc.

YtGuessWho.Infrastructure/
└── DependencyInjection/
    └── InfrastructureModule.cs ← Registers IJamRepository → InMemoryJamRepository, etc.

YtGuessWho.Api/
└── Program.cs                  ← Loads ApplicationModule + InfrastructureModule via AutofacServiceProviderFactory
```

The `Api` layer composition root:

```csharp
// Program.cs
builder.Host.UseServiceProviderFactory(new AutofacServiceProviderFactory());
builder.Host.ConfigureContainer<ContainerBuilder>(container =>
{
    container.RegisterModule<ApplicationModule>();
    container.RegisterModule<InfrastructureModule>();
});
```

All existing `builder.Services` calls (SignalR, CORS, health checks) remain untouched.

