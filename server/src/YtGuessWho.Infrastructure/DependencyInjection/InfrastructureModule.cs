using Autofac;
using YtGuessWho.Application.Repositories;
using YtGuessWho.Infrastructure.Repositories;

namespace YtGuessWho.Infrastructure.DependencyInjection;

/// <summary>
/// Autofac module for the Infrastructure layer.
/// Registers concrete implementations of interfaces defined in the Application layer
/// (repositories, external service adapters, etc.).
/// </summary>
public sealed class InfrastructureModule : Module
{
    protected override void Load(ContainerBuilder builder)
    {
        builder
            .RegisterType<InMemoryJamRepository>()
            .As<IJamRepository>()
            .SingleInstance();
    }
}

