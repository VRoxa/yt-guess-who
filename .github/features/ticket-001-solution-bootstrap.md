# TICKET-001: Solution Bootstrap & Health Endpoint

## User Story

As a developer,
I want a clean, correctly structured ASP.NET Core solution that starts without errors and exposes a `/health` endpoint,
So that we have a verified, deployable baseline from which all future features can be built.

---

## Acceptance Criteria

- **Given** the repository is cloned and `dotnet build` is run from the solution root,
  **When** the build completes,
  **Then** it succeeds with zero errors and zero warnings.

- **Given** the application is running,
  **When** `GET /health` is called,
  **Then** it returns `200 OK`.

- **Given** the application is running,
  **When** any route other than `/health` is called,
  **Then** it returns `404 Not Found` — no scaffold endpoints (e.g. `/weatherforecast`) exist.

- **Given** the solution,
  **When** inspected,
  **Then** it contains exactly the projects defined in `docs/solution-architecture.md` and no others.

---

## Technical Implementation Plan

### 1. Solution Restructure

The existing scaffold (`YtGuessWho.Application`) does not match the agreed Clean Architecture layout. It must be replaced.

**Delete:**
- All weather forecast boilerplate from `Program.cs`
- `Microsoft.AspNetCore.OpenApi` package reference (not needed yet)

**Rename / repurpose** the existing `YtGuessWho.Application` project to `YtGuessWho.Api` — this becomes the ASP.NET Core host and composition root.

**Create** the following new class library projects under `src/`:

| Project | SDK | Purpose |
|---------|-----|---------|
| `YtGuessWho.Domain` | `Microsoft.NET.Sdk` | Entities, value objects, domain events |
| `YtGuessWho.Application` | `Microsoft.NET.Sdk` | Use-case interfaces and services |
| `YtGuessWho.Infrastructure` | `Microsoft.NET.Sdk` | SignalR hub, repository implementations |

**Create** the test project under `tests/`:

| Project | SDK | Purpose |
|---------|-----|---------|
| `YtGuessWho.Tests` | `Microsoft.NET.Sdk` | xUnit test project |

**Register** all new projects in `YtGuessWho.sln`.

---

### 2. Project References

Wire project references to enforce the dependency rule (outer → inner only):

```
YtGuessWho.Api          → Infrastructure, Application, Domain
YtGuessWho.Infrastructure → Application, Domain
YtGuessWho.Application  → Domain
YtGuessWho.Domain       → (none)
YtGuessWho.Tests        → Application, Domain
```

---

### 3. Autofac Setup

Per ADR-003, wire Autofac as the backing IoC container in `YtGuessWho.Api`.

**NuGet packages to add to `YtGuessWho.Api`:**
- `Autofac`
- `Autofac.Extensions.DependencyInjection`

**Files to create:**
- `YtGuessWho.Application/DependencyInjection/ApplicationModule.cs` — empty `Module` stub, ready for future registrations.
- `YtGuessWho.Infrastructure/DependencyInjection/InfrastructureModule.cs` — empty `Module` stub, ready for future registrations.

**Files to modify:**
- `YtGuessWho.Api/Program.cs` — replace `WebApplication.CreateBuilder` default with `UseServiceProviderFactory(new AutofacServiceProviderFactory())` and load both modules.

---

### 4. Health Endpoint

**Files to modify:**
- `YtGuessWho.Api/Program.cs` — map a single `GET /health` endpoint that returns `200 OK` with no body, using `app.MapHealthChecks` or a minimal API route.

**NuGet packages to add to `YtGuessWho.Api`** (if using `MapHealthChecks`):
- `Microsoft.Extensions.Diagnostics.HealthChecks` (ships with ASP.NET Core, no extra package needed).

Register with:
```csharp
builder.Services.AddHealthChecks();
app.MapHealthChecks("/health");
```

---

### 5. Files Summary

| Action | File |
|--------|------|
| Modify | `YtGuessWho.sln` |
| Repurpose / heavily modify | `src/YtGuessWho.Api/Program.cs` |
| Repurpose | `src/YtGuessWho.Api/YtGuessWho.Api.csproj` |
| Create | `src/YtGuessWho.Domain/YtGuessWho.Domain.csproj` |
| Create | `src/YtGuessWho.Application/YtGuessWho.Application.csproj` |
| Create | `src/YtGuessWho.Application/DependencyInjection/ApplicationModule.cs` |
| Create | `src/YtGuessWho.Infrastructure/YtGuessWho.Infrastructure.csproj` |
| Create | `src/YtGuessWho.Infrastructure/DependencyInjection/InfrastructureModule.cs` |
| Create | `tests/YtGuessWho.Tests/YtGuessWho.Tests.csproj` |

---

## Out of Scope for This Ticket

- Any domain entities, value objects, or application services.
- SignalR hub registration.
- CORS configuration.
- Any game logic whatsoever.

