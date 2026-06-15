using FakeItEasy;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using YtGuessWho.Application.Commands;
using YtGuessWho.Application.Exceptions;
using YtGuessWho.Application.Repositories;
using YtGuessWho.Application.Services.Implementations;
using YtGuessWho.Domain.Aggregates;

namespace YtGuessWho.Tests.Application;

/// <summary>
/// Unit tests for <see cref="JamService.CreateJam"/>.
/// </summary>
public sealed class JamServiceTests
{
    private readonly IJamRepository _repository;
    private readonly JamService _sut;

    public JamServiceTests()
    {
        _repository = A.Fake<IJamRepository>();
        var logger = A.Fake<ILogger<JamService>>();
        _sut = new JamService(_repository, logger);
    }

    [Fact]
    public async Task CreateJam_WhenPlayerIsNotInAJam_ReturnsNonEmptyJamCode()
    {
        // Arrange
        A.CallTo(() => _repository.FindByPlayerId("conn-1")).Returns(null);
        var command = new CreateJamCommand("conn-1", "Alice");

        // Act
        var result = await _sut.CreateJam(command);

        // Assert
        result.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task CreateJam_WhenPlayerIsNotInAJam_ReturnsSixCharacterCode()
    {
        // Arrange
        A.CallTo(() => _repository.FindByPlayerId("conn-1")).Returns(null);
        var command = new CreateJamCommand("conn-1", "Alice");

        // Act
        var result = await _sut.CreateJam(command);

        // Assert
        result.Should().HaveLength(6);
    }

    [Fact]
    public async Task CreateJam_WhenPlayerIsNotInAJam_CallsRepositoryAddExactlyOnce()
    {
        // Arrange
        A.CallTo(() => _repository.FindByPlayerId("conn-1")).Returns(null);
        var command = new CreateJamCommand("conn-1", "Alice");

        // Act
        await _sut.CreateJam(command);

        // Assert
        A.CallTo(() => _repository.Add(A<Jam>._)).MustHaveHappenedOnceExactly();
    }

    [Fact]
    public async Task CreateJam_WhenPlayerIsNotInAJam_AddsJamWithHostMatchingConnectionId()
    {
        // Arrange
        A.CallTo(() => _repository.FindByPlayerId("conn-1")).Returns(null);
        var command = new CreateJamCommand("conn-1", "Alice");
        Jam? capturedJam = null;
        A.CallTo(() => _repository.Add(A<Jam>._))
            .Invokes(call => capturedJam = call.GetArgument<Jam>(0));

        // Act
        await _sut.CreateJam(command);

        // Assert
        capturedJam.Should().NotBeNull();
        capturedJam!.Players.Should().HaveCount(1);
        capturedJam.Players[0].PlayerId.Should().Be("conn-1");
        capturedJam.Players[0].IsHost.Should().BeTrue();
    }

    [Fact]
    public async Task CreateJam_WhenPlayerIsAlreadyInAJam_ThrowsPlayerAlreadyInJamException()
    {
        // Arrange
        var existingJam = Jam.CreateNew("conn-1", "Alice");
        A.CallTo(() => _repository.FindByPlayerId("conn-1")).Returns(existingJam);
        var command = new CreateJamCommand("conn-1", "Alice");

        // Act
        var act = async () => await _sut.CreateJam(command);

        // Assert
        await act.Should().ThrowAsync<PlayerAlreadyInJamException>();
    }

    [Fact]
    public async Task CreateJam_WhenPlayerIsAlreadyInAJam_DoesNotCallRepositoryAdd()
    {
        // Arrange
        var existingJam = Jam.CreateNew("conn-1", "Alice");
        A.CallTo(() => _repository.FindByPlayerId("conn-1")).Returns(existingJam);
        var command = new CreateJamCommand("conn-1", "Alice");

        // Act
        try { await _sut.CreateJam(command); } catch (PlayerAlreadyInJamException) { }

        // Assert
        A.CallTo(() => _repository.Add(A<Jam>._)).MustNotHaveHappened();
    }

    [Fact]
    public async Task CreateJam_WithNullCommand_ThrowsArgumentNullException()
    {
        // Arrange & Act
        var act = async () => await _sut.CreateJam(null!);

        // Assert
        await act.Should().ThrowAsync<ArgumentNullException>();
    }
}

