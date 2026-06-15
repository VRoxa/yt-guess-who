namespace YtGuessWho.Application.Exceptions;

/// <summary>
/// Thrown by <see cref="YtGuessWho.Application.Services.Implementations.JamService"/> when a player
/// attempts to create or join a Jam while already associated with an active Jam.
/// </summary>
/// <remarks>
/// The Hub layer catches this exception and sends an <c>Error</c> event to the caller
/// with code <c>ALREADY_IN_JAM</c> rather than propagating it as an unhandled exception.
/// </remarks>
public sealed class PlayerAlreadyInJamException : Exception
{
    /// <summary>
    /// Initialises a new <see cref="PlayerAlreadyInJamException"/> for the given connection.
    /// </summary>
    /// <param name="connectionId">The ConnectionId of the player who is already in a Jam.</param>
    public PlayerAlreadyInJamException(string connectionId)
        : base($"Player '{connectionId}' is already in an active Jam.")
    {
    }
}

