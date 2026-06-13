using Autofac;
using Autofac.Extensions.DependencyInjection;
using YtGuessWho.Application.DependencyInjection;
using YtGuessWho.Infrastructure.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

builder.Host
    .UseServiceProviderFactory(new AutofacServiceProviderFactory())
    .ConfigureContainer<ContainerBuilder>(container =>
    {
        container.RegisterModule<ApplicationModule>();
        container.RegisterModule<InfrastructureModule>();
    });

builder.Services.AddHealthChecks();

var app = builder.Build();

app.MapHealthChecks("/health");

app.Run();
