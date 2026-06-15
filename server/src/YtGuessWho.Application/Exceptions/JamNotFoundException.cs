namespace YtGuessWho.Application.Exceptions;

/// <summary>
/// Thrown by <see cref="YtGuessWho.Application.Services.Implementations.JamService"/> when a
/// <see cref="Commands.JoinJamCommand"/> references a Jam code that does not match any active Jam.
/// </summary>
/// <remarks>
/// This is an application-boundary lookup concern, not a domain invariant — it requires
/// querying the repository and therefore lives in the Application layer rather than the Domain.
/// </remarks>
public sealed class JamNotFoundException : Exception
{
    /// <summary>
    /// Initialises a new <see cref="JamNotFoundException"/> for the given code.
    /// </summary>
    /// <param name="jamCode">The Jam code that could not be found.</param>
    public JamNotFoundException(string jamCode)
        : base($"No active Jam with code '{jamCode}' was found.")
    {
    }
}

