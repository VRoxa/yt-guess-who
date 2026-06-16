namespace YtGuessWho.Domain.Exceptions;

/// <summary>
/// Thrown when a raw string provided as a YouTube URL does not match any accepted YouTube URL format.
/// </summary>
public sealed class InvalidYoutubeUrlException : DomainException
{
    /// <summary>
    /// Initialises a new <see cref="InvalidYoutubeUrlException"/> for the given raw string.
    /// </summary>
    /// <param name="rawUrl">The raw string that failed YouTube URL validation.</param>
    public InvalidYoutubeUrlException(string rawUrl)
        : base($"'{rawUrl}' is not a valid YouTube URL. Accepted formats: youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/…")
    {
    }
}

