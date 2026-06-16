namespace YtGuessWho.Domain.Exceptions;

/// <summary>
/// Thrown when a non-Host Player attempts an action that is restricted to the Host.
/// </summary>
public sealed class UnauthorizedHostActionException : DomainException
{
    /// <summary>
    /// Initialises a new <see cref="UnauthorizedHostActionException"/> for the given connection.
    /// </summary>
    /// <param name="connectionId">The ConnectionId of the Player who attempted the Host-only action.</param>
    public UnauthorizedHostActionException(string connectionId)
        : base($"Player '{connectionId}' is not the Host and is not authorised to perform this action.")
    {
    }
}

