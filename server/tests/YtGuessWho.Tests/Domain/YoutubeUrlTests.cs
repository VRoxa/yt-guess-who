using FluentAssertions;
using YtGuessWho.Domain.Exceptions;
using YtGuessWho.Domain.ValueObjects;

namespace YtGuessWho.Tests.Domain;

/// <summary>
/// Unit tests for <see cref="YoutubeUrl"/>.
/// </summary>
public sealed class YoutubeUrlTests
{
    // ── Valid URLs ────────────────────────────────────────────────────────────

    [Fact]
    public void Constructor_WithValidStandardUrl_SetsValueProperty()
    {
        // Arrange
        const string url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

        // Act
        var result = new YoutubeUrl(url);

        // Assert
        result.Value.Should().Be(url);
    }

    [Fact]
    public void Constructor_WithValidShortUrl_SetsValueProperty()
    {
        // Arrange
        const string url = "https://youtu.be/dQw4w9WgXcQ";

        // Act
        var result = new YoutubeUrl(url);

        // Assert
        result.Value.Should().Be(url);
    }

    [Fact]
    public void Constructor_WithValidShortsUrl_SetsValueProperty()
    {
        // Arrange
        const string url = "https://www.youtube.com/shorts/dQw4w9WgXcQ";

        // Act
        var result = new YoutubeUrl(url);

        // Assert
        result.Value.Should().Be(url);
    }

    [Fact]
    public void Constructor_WithHttpScheme_SetsValueProperty()
    {
        // Arrange
        const string url = "http://www.youtube.com/watch?v=dQw4w9WgXcQ";

        // Act
        var result = new YoutubeUrl(url);

        // Assert
        result.Value.Should().Be(url);
    }

    [Fact]
    public void Constructor_WithNonWwwHost_SetsValueProperty()
    {
        // Arrange
        const string url = "https://youtube.com/watch?v=dQw4w9WgXcQ";

        // Act
        var result = new YoutubeUrl(url);

        // Assert
        result.Value.Should().Be(url);
    }

    [Fact]
    public void Constructor_WithMobileHost_SetsValueProperty()
    {
        // Arrange
        const string url = "https://m.youtube.com/watch?v=dQw4w9WgXcQ";

        // Act
        var result = new YoutubeUrl(url);

        // Assert
        result.Value.Should().Be(url);
    }

    // ── Invalid URLs ──────────────────────────────────────────────────────────

    [Fact]
    public void Constructor_WithEmptyString_ThrowsInvalidYoutubeUrlException()
    {
        // Arrange & Act
        var act = () => new YoutubeUrl(string.Empty);

        // Assert
        act.Should().Throw<InvalidYoutubeUrlException>();
    }

    [Fact]
    public void Constructor_WithNonYoutubeUrl_ThrowsInvalidYoutubeUrlException()
    {
        // Arrange & Act
        var act = () => new YoutubeUrl("https://www.google.com");

        // Assert
        act.Should().Throw<InvalidYoutubeUrlException>();
    }

    [Fact]
    public void Constructor_WithYoutubeUrlMissingVideoId_ThrowsInvalidYoutubeUrlException()
    {
        // Arrange & Act — watch URL with no v= parameter
        var act = () => new YoutubeUrl("https://www.youtube.com/watch");

        // Assert
        act.Should().Throw<InvalidYoutubeUrlException>();
    }

    [Fact]
    public void Constructor_WithYoutubeUrlWithEmptyVideoId_ThrowsInvalidYoutubeUrlException()
    {
        // Arrange & Act — watch URL with empty v= value
        var act = () => new YoutubeUrl("https://www.youtube.com/watch?v=");

        // Assert
        act.Should().Throw<InvalidYoutubeUrlException>();
    }

    [Fact]
    public void Constructor_WithShortsUrlMissingVideoId_ThrowsInvalidYoutubeUrlException()
    {
        // Arrange & Act
        var act = () => new YoutubeUrl("https://www.youtube.com/shorts/");

        // Assert
        act.Should().Throw<InvalidYoutubeUrlException>();
    }

    [Fact]
    public void Constructor_WithShortUrlMissingPath_ThrowsInvalidYoutubeUrlException()
    {
        // Arrange & Act — youtu.be with no video ID segment
        var act = () => new YoutubeUrl("https://youtu.be/");

        // Assert
        act.Should().Throw<InvalidYoutubeUrlException>();
    }

    [Fact]
    public void Constructor_WithPlainString_ThrowsInvalidYoutubeUrlException()
    {
        // Arrange & Act
        var act = () => new YoutubeUrl("not a url");

        // Assert
        act.Should().Throw<InvalidYoutubeUrlException>();
    }

    [Fact]
    public void Constructor_WithNull_ThrowsArgumentNullException()
    {
        // Arrange & Act
        var act = () => new YoutubeUrl(null!);

        // Assert
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("rawUrl");
    }
}

