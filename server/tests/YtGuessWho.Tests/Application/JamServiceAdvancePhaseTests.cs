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
using YtGuessWho.Domain.Extensions;

namespace YtGuessWho.Tests.Application;

/// <summary>
/// Unit tests for <see cref="JamService.AdvancePhase"/>.
/// </summary>
public sealed class JamServiceAdvancePhaseTests
{
    private readonly IJamRepository _repository;
    private readonly JamService _sut;

    public JamServiceAdvancePhaseTests()
    {
        _repository = A.Fake<IJamRepository>();
        var logger = A.Fake<ILogger<JamService>>();
        _sut = new JamService(_repository, logger);
    }

    [Fact]
    public async Task AdvancePhase_WhenCallerIsHost_ReturnsResultWithSubmissionPhase()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        A.CallTo(() => _repository.FindByPlayerId("host-conn")).Returns(jam);

        // Act
        var result = await _sut.AdvancePhase(new AdvancePhaseCommand("host-conn"));

        // Assert
        result.NewPhase.Should().Be(JamPhase.Submission.ToString());
    }

    [Fact]
    public async Task AdvancePhase_WhenCallerIsHost_ReturnsResultWithJamCode()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        A.CallTo(() => _repository.FindByPlayerId("host-conn")).Returns(jam);

        // Act
        var result = await _sut.AdvancePhase(new AdvancePhaseCommand("host-conn"));

        // Assert
        result.JamCode.Should().Be(jam.JamCode.Value);
    }

    [Fact]
    public async Task AdvancePhase_WhenPlayerNotInJam_ThrowsNotInJamException()
    {
        // Arrange
        A.CallTo(() => _repository.FindByPlayerId("unknown-conn")).Returns(null);

        // Act
        var act = () => _sut.AdvancePhase(new AdvancePhaseCommand("unknown-conn"));

        // Assert
        await act.Should().ThrowAsync<NotInJamException>();
    }

    [Fact]
    public async Task AdvancePhase_WhenCallerIsNotHost_ThrowsUnauthorizedHostActionException()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("bob-conn", "Bob");
        A.CallTo(() => _repository.FindByPlayerId("bob-conn")).Returns(jam);

        // Act
        var act = () => _sut.AdvancePhase(new AdvancePhaseCommand("bob-conn"));

        // Assert
        await act.Should().ThrowAsync<UnauthorizedHostActionException>();
    }

    [Fact]
    public async Task AdvancePhase_WhenPhaseIsNotLobby_ThrowsInvalidPhaseTransitionException()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.Phase = JamPhase.Submission;
        A.CallTo(() => _repository.FindByPlayerId("host-conn")).Returns(jam);

        // Act
        var act = () => _sut.AdvancePhase(new AdvancePhaseCommand("host-conn"));

        // Assert
        await act.Should().ThrowAsync<InvalidPhaseTransitionException>();
    }
}

