# TICKET-003: Serilog Structured Logging Setup

## User Story

As a developer,
I want all application and framework log events to be emitted to the console as structured, human-readable output enriched with the originating class name,
So that I can observe server behaviour — including SignalR and ASP.NET Core internal events — without attaching a debugger, in any environment.

---

## Acceptance Criteria

- **Given** the application is started with `dotnet run`,
  **When** any log event is emitted (application or framework),
  **Then** it appears in the console in a consistent format that includes timestamp, level, source context, and message.

- **Given** any class in any layer declares `ILogger<T>` as a constructor dependency and emits a log event,
  **When** that event is written to the console,
  **Then** the log line includes a `SourceContext` property set to the fully-qualified name of `T` — no extra configuration is required inside the declaring class.

- **Given** the application is running,
  **When** a SignalR client connects to `/hubs/game`,
  **Then** at least one `Information`-level log line from the `Microsoft.AspNetCore.SignalR` or `Microsoft.AspNetCore.Http.Connections` namespace is visible in the console.

- **Given** the application is running,
  **When** a SignalR client disconnects from `/hubs/game`,
  **Then** the disconnect event produces a log line in the console.

- **Given** the application is running in any environment (Development, Production, or any other),
  **When** a `Debug`-level event is emitted from `YtGuessWho.*` code,
  **Then** it appears in the console — `Debug` is the global minimum level in all environments.

- **Given** a project other than `YtGuessWho.Api`,
  **When** that project's code emits a log event via an injected `ILogger<T>`,
  **Then** no reference to any Serilog type or package is required in that project — the Serilog dependency is confined entirely to `YtGuessWho.Api`.

---

## Technical Notes

### Architecture placement

This ticket touches **Layer 4 (`YtGuessWho.Api`) only**. The constraint that inner layers depend exclusively on `ILogger<T>` is defined in `docs/solution-architecture.md#cross-cutting-concerns`. The choice of Serilog and the rationale for the bootstrap pattern are recorded in `docs/adr/ADR-004-serilog-logging.md`.

### Files to create or modify

| Action | File | Notes |
|--------|------|-------|
| Modify | `src/YtGuessWho.Api/YtGuessWho.Api.csproj` | Add `Serilog.AspNetCore` package reference |
| Modify | `src/YtGuessWho.Api/Program.cs` | Add the two-phase Serilog bootstrap (see constraints below); remove any pre-existing MEL `builder.Logging` block if present |
| Modify | `src/YtGuessWho.Api/appsettings.json` | Ensure no `Logging` section exists — Serilog does not read MEL's `Logging` key; the only required key is `AllowedHosts` |
| Modify | `src/YtGuessWho.Api/appsettings.Development.json` | Ensure no `Logging` section exists — same reason; file may be left as `{}` or contain only non-logging configuration |

### NuGet packages

| Package | Target project | Notes |
|---------|----------------|-------|
| `Serilog.AspNetCore` | `YtGuessWho.Api` | Meta-package; pulls in `Serilog`, `Serilog.Extensions.Hosting`, `Serilog.Extensions.Logging`, and `Serilog.Sinks.Console`. No Serilog package is added to any other project. |

### Key design constraints

**Two-phase bootstrap pattern.**
Serilog must be initialised in two distinct phases inside `Program.cs`:

- *Phase 1 — Bootstrap logger* (before `WebApplication.CreateBuilder` is called): Assign `Log.Logger` using `new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger()`. This ensures that any exception thrown during host construction (e.g., a misconfigured Autofac module) is captured and written to the console rather than being lost silently. This is the only permitted use of the static `Log` class — see the convention below.
- *Phase 2 — Full logger* (on the host builder): Call `builder.Host.UseSerilog((ctx, services, cfg) => { ... })`. This replaces the entire MEL pipeline with Serilog. All `ILogger<T>` instances resolved from DI will route through this configuration. The full production configuration — minimum level, overrides, enrichers, and sink — must be declared inside this callback.

**Global minimum level: `Debug`.**
The full logger must call `MinimumLevel.Debug()`. This applies in all environments — there is no environment-specific log-level configuration in this ticket. `Debug` events from `YtGuessWho.*` code must always appear.

**Namespace overrides to control framework noise.**
`MinimumLevel.Debug()` would flood the console with low-level ASP.NET Core and System internals. Apply `MinimumLevel.Override` entries to suppress that noise while keeping useful framework signals:
- `Microsoft.AspNetCore` → `Information`
- `Microsoft.AspNetCore.SignalR` → `Information`
- `Microsoft.AspNetCore.Http.Connections` → `Information`
- `Microsoft` (catch-all for remaining Microsoft namespaces) → `Warning`
- `System` → `Warning`

These overrides do not affect `YtGuessWho.*` — that namespace has no override and therefore falls through to the global `Debug` minimum.

**`ILogger<T>` injection and automatic `SourceContext` enrichment.**
When any class in any layer declares `ILogger<T>` as a constructor dependency, the Serilog MEL bridge automatically sets the `SourceContext` property on every log event to the fully-qualified name of `T` (e.g., `YtGuessWho.Infrastructure.Hubs.GameHub`). For this to flow through to the console output, two things must be true:
1. `.Enrich.FromLogContext()` must be called in the Phase 2 logger configuration.
2. The console output template must include the `{SourceContext}` property.

No code change is required in the declaring class — the enrichment is a pipeline concern entirely owned by `YtGuessWho.Api`.

**Console output template.**
The console sink must use an output template that surfaces timestamp, level, source context, message, and exception. Use:
`[{Timestamp:HH:mm:ss} {Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}`

**Static `Log` class restriction.**
Per `docs/adr/ADR-004-serilog-logging.md#decision-outcome`, `Serilog.Log.*` static methods are permitted only in the Phase 1 bootstrap block in `Program.cs`. All application code must use injected `ILogger<T>`.

**`appsettings` — no `Logging` section.**
The `Logging` key in `appsettings.json` is read exclusively by MEL's built-in providers. Serilog ignores it entirely. Any `Logging` section present in either settings file must be removed to prevent false confidence that it controls log levels.

### Out of scope

- File, Seq, or any remote sink — console only, per `docs/adr/ADR-004-serilog-logging.md#current-scope`.
- Reading Serilog configuration from `appsettings.json` via `Serilog.Settings.Configuration` — configuration is code-driven in this ticket.
- Request logging middleware (`UseSerilogRequestLogging`) — deferred.
- Per-environment minimum level differences — `Debug` globally is the decided level for now.

---

## Test Plan

> For the **human tester only.**
> Manual verification steps to execute after the Dev has finished and the application is running.

### Tooling

- Terminal running `dotnet run` from `src/YtGuessWho.Api/`
- A second terminal or browser DevTools console to establish a SignalR connection
- The `src/YtGuessWho.Api/YtGuessWho.Api.http` file, Postman, or `wscat` to connect to `/hubs/game`

### Preconditions

- `dotnet run` completes successfully with no build errors
- Console output is visible (not piped to a file)
- No SignalR clients connected yet

---

### Scenario 1 — Startup emits structured log lines in the Serilog format

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Run `dotnet run` from `src/YtGuessWho.Api/` | Console output starts immediately; every line begins with a bracketed timestamp and level, e.g. `[14:32:01 INF]` |
| 2 | Scan the startup lines | At least one line contains a source context from `Microsoft.Hosting.*` or `Microsoft.AspNetCore.*`, confirming framework logs flow through Serilog |
| 3 | Confirm no line uses the old MEL prefix format (e.g., `info: Microsoft.AspNetCore[0]`) | All lines match the Serilog template format exclusively |

### Scenario 2 — `ILogger<T>` is enriched with the declaring class name

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | With the application running, establish a SignalR connection to `/hubs/game` | Connection succeeds |
| 2 | Observe the `OnConnectedAsync` log line in the console | The line includes `YtGuessWho.Infrastructure.Hubs.GameHub` as the source context, e.g. `[14:32:05 INF] YtGuessWho.Infrastructure.Hubs.GameHub: Client connected ...` |
| 3 | No code change was made inside `GameHub` | The source context is populated purely by the Serilog pipeline — the class itself only calls `_logger.LogInformation(...)` |

### Scenario 3 — SignalR framework logs are visible at `Information` level

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Connect a SignalR client to `/hubs/game` | Connection is established |
| 2 | Observe the console | At least one `INF` line with source context `Microsoft.AspNetCore.SignalR.*` or `Microsoft.AspNetCore.Http.Connections.*` appears |
| 3 | Disconnect the client | A log line from `GameHub.OnDisconnectedAsync` appears; no unhandled exception stack trace is printed |

### Scenario 4 — `Debug` level is active in all environments

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Run the application without setting `ASPNETCORE_ENVIRONMENT` (defaults to `Production`) | `dotnet run` starts normally |
| 2 | Connect and disconnect a client | `DBG`-level lines from `YtGuessWho.*` source contexts appear in the console |
| 3 | Run the application with `ASPNETCORE_ENVIRONMENT=Development` and repeat | Identical `DBG`-level lines appear — level behaviour does not change between environments |

### Scenario 5 — Framework noise is suppressed below `Information`

| Step | Tester action | Expected result |
|------|---------------|-----------------|
| 1 | Connect and disconnect a client | Console output is readable — no flood of `DBG`-level lines from `Microsoft.*` or `System.*` namespaces (e.g., socket buffer allocations, keep-alive pings, routing internals) |
| 2 | Confirm `DBG` lines are present but scoped only to `YtGuessWho.*` source contexts | Framework namespaces appear at `INF` or `WRN` level only |
