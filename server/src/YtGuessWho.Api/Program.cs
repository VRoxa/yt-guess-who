using Autofac;
using Autofac.Extensions.DependencyInjection;
using Serilog;
using Serilog.Events;
using YtGuessWho.Application.DependencyInjection;
using YtGuessWho.Infrastructure.DependencyInjection;
using YtGuessWho.Infrastructure.Hubs;

// Phase 1 — Bootstrap logger: captures any exceptions thrown during host construction
// (e.g. a misconfigured Autofac module) so they are written to the console rather than
// lost silently. This is the only permitted use of the static Log class.
// See docs/adr/ADR-004-serilog-logging.md — Two-phase bootstrap pattern.
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

var builder = WebApplication.CreateBuilder(args);

builder.Host
    .UseServiceProviderFactory(new AutofacServiceProviderFactory())
    .ConfigureContainer<ContainerBuilder>(container =>
    {
        container.RegisterModule<ApplicationModule>();
        container.RegisterModule<InfrastructureModule>();
    });

// Phase 2 — Full logger: replaces the entire MEL pipeline with Serilog.
// All ILogger<T> instances resolved from DI route through this configuration.
// Overrides suppress framework noise; YtGuessWho.* has no override and falls
// through to the global Debug minimum. FromLogContext() populates SourceContext
// automatically from ILogger<T>, surfacing the fully-qualified class name in
// every log line without any code change in the declaring class.
// See docs/adr/ADR-004-serilog-logging.md.
builder.Host.UseSerilog((_, _, cfg) =>
    cfg.MinimumLevel.Debug()
       .MinimumLevel.Override("Microsoft.AspNetCore.SignalR", LogEventLevel.Information)
       .MinimumLevel.Override("Microsoft.AspNetCore.Http.Connections", LogEventLevel.Information)
       .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Information)
       .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
       .MinimumLevel.Override("System", LogEventLevel.Warning)
       .Enrich.FromLogContext()
       .WriteTo.Console(
           outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}"));

builder.Services.AddHealthChecks();

// CORS: allow any origin during early development.
// A restricted origin whitelist (read from appsettings.json) will replace this
// in a later ticket per docs/realtime-communication.md#cors.
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader()));

builder.Services.AddSignalR();

var app = builder.Build();

// UseCors() must precede MapHub<> so CORS headers are present on the
// SignalR negotiate response. See ticket-002 Technical Notes — Middleware ordering.
app.UseCors();

app.MapHealthChecks("/health");
app.MapHub<GameHub>("/hubs/game");

app.Run();


