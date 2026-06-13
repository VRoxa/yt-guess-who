using Autofac;

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
        // Infrastructure implementations will be registered here as they are introduced.
        // Example:
        //   builder.RegisterType<InMemoryJamRepository>().As<IJamRepository>().SingleInstance();
    }
}

