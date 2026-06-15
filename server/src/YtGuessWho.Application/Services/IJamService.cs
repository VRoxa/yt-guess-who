using YtGuessWho.Application.Commands;

namespace YtGuessWho.Application.Services;

/// <summary>
/// Application service that orchestrates Jam lifecycle use-cases.
/// </summary>
public interface IJamService
{
    /// <summary>
    /// Creates a new Jam, registers the caller as the Host, and persists it.
    /// </summary>
    /// <param name="command">The command carrying the caller's ConnectionId and chosen display name.</param>
    /// <param name="cancellationToken">Token to observe for cancellation requests.</param>
    /// <returns>The generated Jam code as a string, to be returned to the calling client.</returns>
    /// <exception cref="YtGuessWho.Application.Exceptions.PlayerAlreadyInJamException">
    /// Thrown when the player identified by <see cref="CreateJamCommand.ConnectionId"/> is
    /// already associated with an active Jam.
    /// </exception>
    Task<string> CreateJam(CreateJamCommand command, CancellationToken cancellationToken = default);
}

