using YtGuessWho.Domain.Exceptions;

namespace YtGuessWho.Domain.ValueObjects;

/// <summary>
/// Immutable value object representing a validated YouTube URL.
/// </summary>
/// <remarks>
/// Accepted formats: standard watch URL (<c>youtube.com/watch?v=…</c>),
/// short URL (<c>youtu.be/…</c>), and Shorts URL (<c>youtube.com/shorts/…</c>).
/// Both <c>http</c> and <c>https</c> schemes are accepted.
/// </remarks>
public sealed class YoutubeUrl
{
    private static readonly string[] ValidHosts =
        ["www.youtube.com", "youtube.com", "youtu.be", "m.youtube.com"];

    /// <summary>The validated YouTube URL string.</summary>
    public string Value { get; }

    /// <summary>
    /// Initialises a new <see cref="YoutubeUrl"/>, validating the format of <paramref name="rawUrl"/>.
    /// </summary>
    /// <param name="rawUrl">The raw URL string to validate and wrap.</param>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="rawUrl"/> is <c>null</c>.</exception>
    /// <exception cref="InvalidYoutubeUrlException">
    /// Thrown when <paramref name="rawUrl"/> does not match an accepted YouTube URL format.
    /// </exception>
    public YoutubeUrl(string rawUrl)
    {
        ArgumentNullException.ThrowIfNull(rawUrl);

        if (!IsValid(rawUrl))
        {
            throw new InvalidYoutubeUrlException(rawUrl);
        }

        Value = rawUrl;
    }

    private static bool IsValid(string rawUrl)
    {
        if (!Uri.TryCreate(rawUrl, UriKind.Absolute, out var uri))
        {
            return false;
        }

        if (uri.Scheme is not "http" and not "https")
        {
            return false;
        }

        var host = uri.Host.ToLowerInvariant();

        if (!Array.Exists(ValidHosts, h => h == host))
        {
            return false;
        }

        // youtu.be/<videoId> — path must have content beyond the leading slash
        if (host == "youtu.be")
        {
            return uri.AbsolutePath.Length > 1;
        }

        // youtube.com/watch?v=<videoId>
        if (uri.AbsolutePath.Equals("/watch", StringComparison.OrdinalIgnoreCase))
        {
            return HasQueryParam(uri.Query, "v");
        }

        // youtube.com/shorts/<videoId>
        if (uri.AbsolutePath.StartsWith("/shorts/", StringComparison.OrdinalIgnoreCase))
        {
            return uri.AbsolutePath.Length > "/shorts/".Length;
        }

        return false;
    }

    /// <summary>
    /// Checks whether a query string contains a non-empty value for <paramref name="key"/>.
    /// Uses a simple linear scan to avoid a dependency on <c>System.Web</c>.
    /// </summary>
    private static bool HasQueryParam(string query, string key)
    {
        var span = query.AsSpan().TrimStart('?');

        foreach (var segment in span.Split('&'))
        {
            var part = span[segment];
            var eq = part.IndexOf('=');

            if (eq < 0)
            {
                continue;
            }

            if (part[..eq].Equals(key, StringComparison.OrdinalIgnoreCase) && eq < part.Length - 1)
            {
                return true;
            }
        }

        return false;
    }
}
