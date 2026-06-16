using YtGuessWho.Domain.Enums;

namespace YtGuessWho.Domain.Exceptions;

/// <summary>
/// Thrown when a phase transition is attempted from an invalid current phase.
/// </summary>
public sealed class InvalidPhaseTransitionException : DomainException
{
    /// <summary>
    /// Initialises a new <see cref="InvalidPhaseTransitionException"/> for the given current phase.
    /// </summary>
    /// <param name="currentPhase">The phase the Jam is currently in when the invalid transition was attempted.</param>
    public InvalidPhaseTransitionException(JamPhase currentPhase)
        : base($"Cannot advance phase from '{currentPhase}'. The Jam is not in the expected phase for this transition.")
    {
    }
}

