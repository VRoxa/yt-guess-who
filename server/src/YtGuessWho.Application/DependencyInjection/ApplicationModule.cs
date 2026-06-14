using Autofac;
using Microsoft.Extensions.Hosting;
using YtGuessWho.Application.Services.Implementations;

namespace YtGuessWho.Application.DependencyInjection;

/// <summary>
/// Autofac module for the Application layer.
/// Registers use-case services and their interfaces.
/// </summary>
public sealed class ApplicationModule : Module
{
    protected override void Load(ContainerBuilder builder)
    {
        builder
            .RegisterType<AppBootstrapper>()
            .As<IHostedService>()
            .SingleInstance();
    }
}

