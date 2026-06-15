namespace YtGuessWho.Application.Exceptions;

/// <summary>
/// Thrown by <see cref="YtGuessWho.Application.Services.Implementations.JamService"/> when
/// a Player attempts an action that requires them to be in a Jam, but they are not associated
/// with any active Jam.
/// </summary>
/// <remarks>
/// The Hub layer catches this exception and sends an <c>Error</c> event to the caller
/// with code <c>NOT_IN_JAM</c>.
/// </remarks>
public sealed class NotInJamException : Exception
{
    /// <summary>
    /// Initialises a new <see cref="NotInJamException"/> for the given connection.
    /// </summary>
    /// <param name="connectionId">The ConnectionId of the Player who is not in a Jam.</param>
    public NotInJamException(string connectionId)
        : base($"Player '{connectionId}' is not currently in any active Jam.")
    {
    }
}

