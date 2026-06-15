namespace YtGuessWho.Domain.Exceptions;

/// <summary>
/// Base class for all domain invariant violations in YtGuessWho.
/// </summary>
/// <remarks>
/// All exceptions that represent a violated business rule must inherit from this class.
/// This allows the Infrastructure and Api layers to catch the entire family at once
/// without depending on specific exception types.
/// See <c>docs/guidelines/csharp-coding-standards.md</c> §2.10 rule 46.
/// </remarks>
public abstract class DomainException : Exception
{
    /// <summary>
    /// Initialises a new <see cref="DomainException"/> with a descriptive message.
    /// </summary>
    /// <param name="message">Human-readable description of the violated invariant.</param>
    protected DomainException(string message) : base(message)
    {
    }
}

