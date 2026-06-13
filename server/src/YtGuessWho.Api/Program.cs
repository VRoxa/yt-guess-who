using Autofac;
using Autofac.Extensions.DependencyInjection;
using YtGuessWho.Application.DependencyInjection;
using YtGuessWho.Infrastructure.DependencyInjection;
using YtGuessWho.Infrastructure.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Host
    .UseServiceProviderFactory(new AutofacServiceProviderFactory())
    .ConfigureContainer<ContainerBuilder>(container =>
    {
        container.RegisterModule<ApplicationModule>();
        container.RegisterModule<InfrastructureModule>();
    });

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


