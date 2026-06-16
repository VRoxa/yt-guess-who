namespace YtGuessWho.Domain.Exceptions;

/// <summary>
/// Thrown when a Player attempts to submit a song after they have already submitted one in this Jam.
/// </summary>
public sealed class AlreadySubmittedException : DomainException
{
    /// <summary>
    /// Initialises a new <see cref="AlreadySubmittedException"/> for the given player.
    /// </summary>
    /// <param name="playerId">The PlayerId of the Player who has already submitted.</param>
    public AlreadySubmittedException(string playerId)
        : base($"Player '{playerId}' has already submitted a song for this Jam.")
    {
    }
}

