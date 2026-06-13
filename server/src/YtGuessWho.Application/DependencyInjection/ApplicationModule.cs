using Autofac;

namespace YtGuessWho.Application.DependencyInjection;

/// <summary>
/// Autofac module for the Application layer.
/// Registers use-case services and their interfaces.
/// </summary>
public sealed class ApplicationModule : Module
{
    protected override void Load(ContainerBuilder builder)
    {
        // Application services will be registered here as they are introduced.
        // Example:
        //   builder.RegisterType<JamService>().As<IJamService>().InstancePerLifetimeScope();
    }
}

