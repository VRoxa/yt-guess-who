# ADR-004: Serilog as the Structured Logging Library

* **Status:** Accepted
* **Date:** 2026-06-14
* **Context/Problem Statement:** The application needs an observable logging pipeline from day one. ASP.NET Core ships with a built-in `Microsoft.Extensions.Logging` (MEL) abstraction and a console provider, which is enough to emit text to stdout. However, the abstraction alone does not decide *how* structured the output is, *how easy* it is to add new sinks later (file, Seq, OpenTelemetry, cloud), or *how consistent* log enrichment (correlation IDs, Hub connection IDs, environment tags) will be across layers. A concrete logging library must be chosen that integrates with MEL (so all framework and third-party logs flow through the same pipeline) while offering a clear upgrade path as operational requirements grow.

---

## Options Considered

### Option 1: Microsoft.Extensions.Logging — Built-in Console Provider Only

* **Description:** Use only the abstractions and providers that ship with the ASP.NET Core runtime (`Microsoft.Extensions.Logging`, `Microsoft.Extensions.Logging.Console`). Configured entirely via `appsettings.json` log-level filters and `builder.Logging.AddConsole()`.
* **Pros:**
  * Zero extra NuGet dependencies.
  * Universally known by any .NET developer.
  * Sufficient for simple scenarios where plain text stdout is the only output target.
* **Cons:**
  * Output format is not structured by default — JSON console output requires explicit configuration and is limited in customisation.
  * **No sink abstraction:** adding a second output target (file, Seq, cloud) requires swapping or layering separate provider packages; there is no single composition point.
  * **No enrichment pipeline:** attaching contextual properties (request ID, connection ID, environment) must be done manually at each call site or via middleware with no shared convention.
  * Log output format changes require code changes; no declarative, configuration-driven pipeline.
  * No support for destructuring policies or custom output templates — difficult to enforce a team-wide log format.

---

### Option 2: Serilog

* **Description:** A structured-logging library for .NET that implements `Microsoft.Extensions.Logging.ILoggerFactory`, meaning all framework logs (ASP.NET Core, SignalR, Autofac, etc.) flow through it automatically. A `LoggerConfiguration` is built in `Program.cs`, sinks are declared fluently, and Autofac modules can inject `ILogger` without knowing about Serilog directly.
* **Pros:**
  * **Structured by design:** every log event is a first-class object with named properties, not a formatted string. Console output today, queryable JSON tomorrow — no code changes required.
  * **Sink ecosystem:** 100+ community sinks (Console, File, Seq, Elastic, Application Insights, OpenTelemetry). Adding a new output target is a one-line `WriteTo.*` call in the configuration — no architectural change.
  * **Enrichers:** declarative, composable enrichers (`WithEnvironmentName`, `WithMachineName`, `WithCorrelationId`, `FromLogContext`) attach contextual data once at startup rather than at every call site.
  * **Sub-logger / filter:** `WriteTo.Logger(lc => lc.Filter.ByIncludingOnly(...))` enables routing different log levels or sources to different sinks without code duplication.
  * **MEL bridge:** `UseSerilog()` on the host builder replaces the default MEL providers while keeping all injected `ILogger<T>` signatures unchanged — zero impact on existing or future application code.
  * **Output templates:** fully declarative, configuration-driven log format (timestamp, level, source context, message, properties) — consistent across all team members without per-call formatting.
  * Mature, actively maintained; well-documented; widely used in .NET production systems.
* **Cons:**
  * Additional NuGet packages (`Serilog`, `Serilog.Extensions.Hosting`, `Serilog.Sinks.Console`, and sink packages as needed).
  * Two-phase initialisation pattern (`Log.Logger = ...` before `builder.Build()`) is unfamiliar to developers who have only used MEL.
  * Static `Log` class is available but should be avoided in application code in favour of injected `ILogger<T>` — a convention that must be communicated to the team.

### Option 3: NLog

* **Description:** Another mature structured logging library for .NET with MEL integration, XML/JSON-based configuration, and a large sink library.
* **Pros:**
  * XML/JSON configuration without code — appealing for ops-driven environments.
  * Large community; long track record.
* **Cons:**
  * Configuration is XML-first, which is less idiomatic in modern .NET projects that favour code-centric fluent APIs.
  * Smaller sink ecosystem than Serilog in the modern .NET space.
  * Less alignment with the team's existing fluent, code-centric configuration style (Autofac modules, `Program.cs` fluent builder).
  * No clear advantage over Serilog for this project's requirements.

---

## Decision Outcome

* **Chosen Option:** Option 2 — Serilog.
* **Justification:** The immediate requirement is console output; the strategic requirement is a logging pipeline that can grow without architectural change. Serilog satisfies both: it delivers structured, human-readable console output today via `Serilog.Sinks.Console`, and it decouples the *what* (structured log events) from the *where* (sinks) so that adding Seq, a file sink, or OpenTelemetry in the future is purely additive. The MEL bridge means all ASP.NET Core and SignalR framework logs surface automatically — which directly addresses the observed problem of framework logs not appearing in the console. The cost is a small set of NuGet packages and a two-phase bootstrap pattern in `Program.cs`.
* **Consequences:**
  * **Gained:** Structured log events from day one; single composition point for all sinks and enrichers; full visibility of ASP.NET Core, SignalR, and Autofac internal logs via `MinimumLevel.Override`; declarative output templates; clear upgrade path to any future observability target.
  * **Accepted cost:** Three to four NuGet packages; team must understand the bootstrap pattern and must prefer injected `ILogger<T>` over the static `Log` class in application code.
  * **Current scope:** Only `Serilog.Sinks.Console` is configured. Minimum level overrides are set to expose `Information`-level framework logs (ASP.NET Core, SignalR) and `Warning`-level for noisy internal namespaces. No file or remote sink is configured at this time.
  * **Future:** Adding a sink (e.g., Seq for local development, Application Insights for production) requires one `WriteTo.*` line and the corresponding NuGet package — no changes to application or infrastructure code.
  * **Convention:** All application code (`Domain`, `Application`, `Infrastructure`) must declare `ILogger<T>` as a constructor dependency. Direct use of `Serilog.Log.*` static methods is forbidden outside of the bootstrap block in `Program.cs`.

