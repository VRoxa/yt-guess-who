using Autofac;
using FluentAssertions;
using YtGuessWho.Application.DependencyInjection;

namespace YtGuessWho.Tests.Application;

/// <summary>
/// Smoke tests verifying the Application layer's Autofac module is structurally correct
/// and can be composed into a DI container without error.
/// </summary>
public sealed class ApplicationModuleTests
{
    [Fact]
    public void ApplicationModule_WhenLoadedIntoContainerBuilder_BuildsContainerWithoutError()
    {
        // Arrange
        var builder = new ContainerBuilder();

        // Act
        builder.RegisterModule<ApplicationModule>();
        var act = () => builder.Build();

        // Assert
        act.Should().NotThrow(
            "the ApplicationModule stub has no registrations that could fail at container build time");
    }

    [Fact]
    public void ApplicationModule_Type_IsSealedAndInheritsFromAutofacModule()
    {
        // Arrange
        var type = typeof(ApplicationModule);

        // Act & Assert
        type.Should().BeSealed(
            "leaf DI modules should be sealed to prevent unintentional subclassing");
        type.Should().BeAssignableTo<Module>(
            "ApplicationModule must inherit from Autofac.Module to participate in container composition");
    }
}

