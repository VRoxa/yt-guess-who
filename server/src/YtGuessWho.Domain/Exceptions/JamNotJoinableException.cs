using YtGuessWho.Domain.Enums;

namespace YtGuessWho.Domain.Exceptions;

/// <summary>
/// Thrown by <see cref="YtGuessWho.Domain.Aggregates.Jam.AddPlayer"/> when a Player attempts
/// to join a Jam that is not in the <see cref="JamPhase.Lobby"/> phase.
/// </summary>
public sealed class JamNotJoinableException : DomainException
{
    /// <summary>
    /// Initialises a new <see cref="JamNotJoinableException"/> for the given phase.
    /// </summary>
    /// <param name="currentPhase">The phase the Jam is currently in.</param>
    public JamNotJoinableException(JamPhase currentPhase)
        : base($"Cannot join a Jam that is in the '{currentPhase}' phase. Joining is only permitted during the Lobby phase.")
    {
    }
}

