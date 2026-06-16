using FluentAssertions;
using YtGuessWho.Domain.Entities;
using YtGuessWho.Domain.Exceptions;
using YtGuessWho.Domain.Extensions;

namespace YtGuessWho.Tests.Domain;

/// <summary>
/// Unit tests for <see cref="PlayerExtensions.SubmitSong"/>.
/// </summary>
public sealed class PlayerExtensionsSubmitSongTests
{
    private const string ValidUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

    [Fact]
    public void SubmitSong_WithValidUrl_SetsSubmissionOnPlayer()
    {
        // Arrange
        var player = new Player("conn-1", "Alice", isHost: false);

        // Act
        player.SubmitSong(ValidUrl);

        // Assert
        player.Submission.Should().NotBeNull();
        player.Submission!.Value.Should().Be(ValidUrl);
    }

    [Fact]
    public void SubmitSong_WhenAlreadySubmitted_ThrowsAlreadySubmittedException()
    {
        // Arrange
        var player = new Player("conn-1", "Alice", isHost: false);
        player.SubmitSong(ValidUrl);

        // Act
        var act = () => player.SubmitSong("https://youtu.be/anotherVideoId");

        // Assert
        act.Should().Throw<AlreadySubmittedException>();
    }

    [Fact]
    public void SubmitSong_WithInvalidUrl_ThrowsInvalidYoutubeUrlException()
    {
        // Arrange
        var player = new Player("conn-1", "Alice", isHost: false);

        // Act
        var act = () => player.SubmitSong("https://www.google.com");

        // Assert
        act.Should().Throw<InvalidYoutubeUrlException>();
    }

    [Fact]
    public void SubmitSong_WithInvalidUrl_DoesNotSetSubmission()
    {
        // Arrange
        var player = new Player("conn-1", "Alice", isHost: false);

        // Act
        try { player.SubmitSong("not-a-youtube-url"); } catch (InvalidYoutubeUrlException) { }

        // Assert
        player.Submission.Should().BeNull();
    }

    [Fact]
    public void SubmitSong_WithNullPlayer_ThrowsArgumentNullException()
    {
        // Arrange
        Player? player = null;

        // Act
        var act = () => player!.SubmitSong(ValidUrl);

        // Assert
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("player");
    }

    [Fact]
    public void SubmitSong_WithNullUrl_ThrowsArgumentNullException()
    {
        // Arrange
        var player = new Player("conn-1", "Alice", isHost: false);

        // Act
        var act = () => player.SubmitSong(null!);

        // Assert
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("youtubeUrl");
    }
}

