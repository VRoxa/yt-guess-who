using FakeItEasy;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using YtGuessWho.Application.Commands;
using YtGuessWho.Application.Exceptions;
using YtGuessWho.Application.Repositories;
using YtGuessWho.Application.Services.Implementations;
using YtGuessWho.Domain.Aggregates;
using YtGuessWho.Domain.Exceptions;
using YtGuessWho.Domain.Extensions;

namespace YtGuessWho.Tests.Application;

/// <summary>
/// Unit tests for <see cref="JamService.SubmitSong"/>.
/// </summary>
public sealed class JamServiceSubmitSongTests
{
    private const string ValidUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    private const string AnotherValidUrl = "https://youtu.be/anotherVideoId";

    private readonly IJamRepository _repository;
    private readonly JamService _sut;

    public JamServiceSubmitSongTests()
    {
        _repository = A.Fake<IJamRepository>();
        var logger = A.Fake<ILogger<JamService>>();
        _sut = new JamService(_repository, logger);
    }

    private static Jam CreateJamInSubmissionPhase(string hostConnectionId, string hostName)
    {
        var jam = Jam.CreateNew(hostConnectionId, hostName);
        jam.AdvancePhase(hostConnectionId);
        return jam;
    }

    [Fact]
    public async Task SubmitSong_WhenFirstPlayerSubmits_ReturnsAllSubmissionsReceivedFalse()
    {
        // Arrange — Bob must be added while the Jam is still in Lobby (before AdvancePhase).
        // AddPlayer enforces Phase == Lobby, so the order matters.
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("bob-conn", "Bob");
        jam.AdvancePhase("host-conn");
        A.CallTo(() => _repository.FindByPlayerId("host-conn")).Returns(jam);

        // Act
        var result = await _sut.SubmitSong(new SubmitSongCommand("host-conn", ValidUrl));

        // Assert
        result.AllSubmissionsReceived.Should().BeFalse();
    }

    [Fact]
    public async Task SubmitSong_WhenLastPlayerSubmits_ReturnsAllSubmissionsReceivedTrue()
    {
        // Arrange
        var jam = CreateJamInSubmissionPhase("host-conn", "Alice");
        // Only one player — host submitting is the last submission
        A.CallTo(() => _repository.FindByPlayerId("host-conn")).Returns(jam);

        // Act
        var result = await _sut.SubmitSong(new SubmitSongCommand("host-conn", ValidUrl));

        // Assert
        result.AllSubmissionsReceived.Should().BeTrue();
    }

    [Fact]
    public async Task SubmitSong_WhenAllPlayersSubmit_ReturnsAllSubmissionsReceivedTrue()
    {
        // Arrange — Bob must be added while the Jam is still in Lobby (before AdvancePhase).
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("bob-conn", "Bob");
        jam.AdvancePhase("host-conn");
        // Alice submits first
        jam.Players.First(p => p.PlayerId == "host-conn").SubmitSong(ValidUrl);
        A.CallTo(() => _repository.FindByPlayerId("bob-conn")).Returns(jam);

        // Act — Bob is the last to submit
        var result = await _sut.SubmitSong(new SubmitSongCommand("bob-conn", AnotherValidUrl));

        // Assert
        result.AllSubmissionsReceived.Should().BeTrue();
    }

    [Fact]
    public async Task SubmitSong_WhenSuccessful_ReturnsResultWithJamCode()
    {
        // Arrange
        var jam = CreateJamInSubmissionPhase("host-conn", "Alice");
        A.CallTo(() => _repository.FindByPlayerId("host-conn")).Returns(jam);

        // Act
        var result = await _sut.SubmitSong(new SubmitSongCommand("host-conn", ValidUrl));

        // Assert
        result.JamCode.Should().Be(jam.JamCode.Value);
    }

    [Fact]
    public async Task SubmitSong_WhenPlayerNotInJam_ThrowsNotInJamException()
    {
        // Arrange
        A.CallTo(() => _repository.FindByPlayerId("unknown-conn")).Returns(null);

        // Act
        var act = () => _sut.SubmitSong(new SubmitSongCommand("unknown-conn", ValidUrl));

        // Assert
        await act.Should().ThrowAsync<NotInJamException>();
    }

    [Fact]
    public async Task SubmitSong_WhenPhaseIsNotSubmission_ThrowsInvalidPhaseTransitionException()
    {
        // Arrange — Jam still in Lobby phase
        var jam = Jam.CreateNew("host-conn", "Alice");
        A.CallTo(() => _repository.FindByPlayerId("host-conn")).Returns(jam);

        // Act
        var act = () => _sut.SubmitSong(new SubmitSongCommand("host-conn", ValidUrl));

        // Assert
        await act.Should().ThrowAsync<InvalidPhaseTransitionException>();
    }

    [Fact]
    public async Task SubmitSong_WhenAlreadySubmitted_ThrowsAlreadySubmittedException()
    {
        // Arrange
        var jam = CreateJamInSubmissionPhase("host-conn", "Alice");
        jam.Players.First(p => p.PlayerId == "host-conn").SubmitSong(ValidUrl);
        A.CallTo(() => _repository.FindByPlayerId("host-conn")).Returns(jam);

        // Act
        var act = () => _sut.SubmitSong(new SubmitSongCommand("host-conn", AnotherValidUrl));

        // Assert
        await act.Should().ThrowAsync<AlreadySubmittedException>();
    }

    [Fact]
    public async Task SubmitSong_WithInvalidUrl_ThrowsInvalidYoutubeUrlException()
    {
        // Arrange
        var jam = CreateJamInSubmissionPhase("host-conn", "Alice");
        A.CallTo(() => _repository.FindByPlayerId("host-conn")).Returns(jam);

        // Act
        var act = () => _sut.SubmitSong(new SubmitSongCommand("host-conn", "https://www.google.com"));

        // Assert
        await act.Should().ThrowAsync<InvalidYoutubeUrlException>();
    }
}

