using FakeItEasy;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using YtGuessWho.Application.Commands;
using YtGuessWho.Application.Exceptions;
using YtGuessWho.Application.Repositories;
using YtGuessWho.Application.Services.Implementations;
using YtGuessWho.Domain.Aggregates;
using YtGuessWho.Domain.Enums;
using YtGuessWho.Domain.Exceptions;

namespace YtGuessWho.Tests.Application;

/// <summary>
/// Unit tests for <see cref="JamService.JoinJam"/>.
/// </summary>
public sealed class JamServiceJoinJamTests
{
    private readonly IJamRepository _repository;
    private readonly JamService _sut;

    public JamServiceJoinJamTests()
    {
        _repository = A.Fake<IJamRepository>();
        var logger = A.Fake<ILogger<JamService>>();
        _sut = new JamService(_repository, logger);
    }

    [Fact]
    public async Task JoinJam_WhenJamExistsAndPlayerIsNotInAJam_AddsPlayerToJam()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        A.CallTo(() => _repository.FindByPlayerId("joiner-conn")).Returns(null);
        A.CallTo(() => _repository.FindByCode("ABCDEF")).Returns(jam);
        var command = new JoinJamCommand("joiner-conn", "ABCDEF", "Bob");

        // Act
        await _sut.JoinJam(command);

        // Assert
        jam.Players.Should().HaveCount(2);
        jam.Players[1].PlayerId.Should().Be("joiner-conn");
        jam.Players[1].DisplayName.Should().Be("Bob");
        jam.Players[1].IsHost.Should().BeFalse();
    }

    [Fact]
    public async Task JoinJam_WhenJamExistsAndPlayerIsNotInAJam_CallsFindByCode()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        A.CallTo(() => _repository.FindByPlayerId("joiner-conn")).Returns(null);
        A.CallTo(() => _repository.FindByCode("ABCDEF")).Returns(jam);
        var command = new JoinJamCommand("joiner-conn", "ABCDEF", "Bob");

        // Act
        await _sut.JoinJam(command);

        // Assert
        A.CallTo(() => _repository.FindByCode("ABCDEF")).MustHaveHappenedOnceExactly();
    }

    [Fact]
    public async Task JoinJam_WhenPlayerIsAlreadyInAJam_ThrowsPlayerAlreadyInJamException()
    {
        // Arrange
        var existingJam = Jam.CreateNew("joiner-conn", "Bob");
        A.CallTo(() => _repository.FindByPlayerId("joiner-conn")).Returns(existingJam);
        var command = new JoinJamCommand("joiner-conn", "ABCDEF", "Bob");

        // Act
        var act = async () => await _sut.JoinJam(command);

        // Assert
        await act.Should().ThrowAsync<PlayerAlreadyInJamException>();
    }

    [Fact]
    public async Task JoinJam_WhenPlayerIsAlreadyInAJam_DoesNotCallFindByCode()
    {
        // Arrange
        var existingJam = Jam.CreateNew("joiner-conn", "Bob");
        A.CallTo(() => _repository.FindByPlayerId("joiner-conn")).Returns(existingJam);
        var command = new JoinJamCommand("joiner-conn", "ABCDEF", "Bob");

        // Act
        try { await _sut.JoinJam(command); } catch (PlayerAlreadyInJamException) { }

        // Assert
        A.CallTo(() => _repository.FindByCode(A<string>._)).MustNotHaveHappened();
    }

    [Fact]
    public async Task JoinJam_WhenJamCodeDoesNotExist_ThrowsJamNotFoundException()
    {
        // Arrange
        A.CallTo(() => _repository.FindByPlayerId("joiner-conn")).Returns(null);
        A.CallTo(() => _repository.FindByCode("ZZZZZZ")).Returns(null);
        var command = new JoinJamCommand("joiner-conn", "ZZZZZZ", "Bob");

        // Act
        var act = async () => await _sut.JoinJam(command);

        // Assert
        await act.Should().ThrowAsync<JamNotFoundException>();
    }

    [Fact]
    public async Task JoinJam_WhenJamIsNotInLobbyPhase_ThrowsJamNotJoinableException()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.Phase = JamPhase.Submission;
        A.CallTo(() => _repository.FindByPlayerId("joiner-conn")).Returns(null);
        A.CallTo(() => _repository.FindByCode("ABCDEF")).Returns(jam);
        var command = new JoinJamCommand("joiner-conn", "ABCDEF", "Bob");

        // Act
        var act = async () => await _sut.JoinJam(command);

        // Assert
        await act.Should().ThrowAsync<JamNotJoinableException>();
    }

    [Fact]
    public async Task JoinJam_WithNullCommand_ThrowsArgumentNullException()
    {
        // Arrange & Act
        var act = async () => await _sut.JoinJam(null!);

        // Assert
        await act.Should().ThrowAsync<ArgumentNullException>();
    }
}

