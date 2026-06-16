using YtGuessWho.Domain.Exceptions;
using YtGuessWho.Domain.ValueObjects;

namespace YtGuessWho.Domain.Extensions;

/// <summary>
/// Contains all instance-level business logic for <see cref="YtGuessWho.Domain.Entities.Player"/>.
/// </summary>
/// <remarks>
/// <see cref="YtGuessWho.Domain.Entities.Player"/> is a pure data class; this companion file is
/// the sole location for domain operations that take a <c>Player</c> as their subject.
/// See <c>docs/guidelines/csharp-coding-standards.md §2.15</c> for the rationale.
/// </remarks>
public static class PlayerExtensions
{
    /// <summary>
    /// Promotes this Player to the Host role by setting <c>IsHost</c> to <c>true</c>.
    /// </summary>
    /// <param name="player">The Player to promote.</param>
    /// <exception cref="ArgumentNullException">
    /// Thrown when <paramref name="player"/> is <c>null</c>.
    /// </exception>
    public static void PromoteToHost(this Entities.Player player)
    {
        ArgumentNullException.ThrowIfNull(player);

        player.IsHost = true;
    }

    /// <summary>
    /// Records the Player's Submission by setting their <see cref="Entities.Player.Submission"/>
    /// to a validated <see cref="YoutubeUrl"/>.
    /// </summary>
    /// <param name="player">The Player submitting a song.</param>
    /// <param name="youtubeUrl">The raw YouTube URL string to validate and record.</param>
    /// <exception cref="ArgumentNullException">
    /// Thrown when <paramref name="player"/> or <paramref name="youtubeUrl"/> is <c>null</c>.
    /// </exception>
    /// <exception cref="AlreadySubmittedException">
    /// Thrown when the Player has already submitted a song in this Jam.
    /// </exception>
    /// <exception cref="InvalidYoutubeUrlException">
    /// Thrown when <paramref name="youtubeUrl"/> does not match an accepted YouTube URL format.
    /// </exception>
    public static void SubmitSong(this Entities.Player player, string youtubeUrl)
    {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(youtubeUrl);

        if (player.Submission is not null)
        {
            throw new AlreadySubmittedException(player.PlayerId);
        }

        // InvalidYoutubeUrlException propagates naturally if the URL is invalid.
        player.Submission = new YoutubeUrl(youtubeUrl);
    }
}

