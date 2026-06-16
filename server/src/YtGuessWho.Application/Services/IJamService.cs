using YtGuessWho.Application.Commands;
using YtGuessWho.Application.DTOs;

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
    /// <exception cref="Exceptions.PlayerAlreadyInJamException">
    /// Thrown when the player identified by <see cref="CreateJamCommand.ConnectionId"/> is
    /// already associated with an active Jam.
    /// </exception>
    Task<string> CreateJam(CreateJamCommand command, CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds the calling Player to an existing Jam identified by its invite code.
    /// </summary>
    /// <param name="command">The command carrying the caller's ConnectionId, the Jam code, and their display name.</param>
    /// <param name="cancellationToken">Token to observe for cancellation requests.</param>
    /// <exception cref="Exceptions.PlayerAlreadyInJamException">
    /// Thrown when the player identified by <see cref="JoinJamCommand.ConnectionId"/> is
    /// already associated with an active Jam.
    /// </exception>
    /// <exception cref="Exceptions.JamNotFoundException">
    /// Thrown when no active Jam matching <see cref="JoinJamCommand.JamCode"/> exists.
    /// </exception>
    /// <exception cref="YtGuessWho.Domain.Exceptions.JamNotJoinableException">
    /// Thrown when the Jam exists but is not in the <c>Lobby</c> phase.
    /// </exception>
    Task JoinJam(JoinJamCommand command, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the ordered list of Players currently in the specified Jam.
    /// </summary>
    /// <param name="jamCode">The invite code of the Jam to query.</param>
    /// <param name="cancellationToken">Token to observe for cancellation requests.</param>
    /// <returns>
    /// A read-only, ordered list of <see cref="PlayerSnapshot"/> — one entry per current Player,
    /// in the order they joined (Host first).
    /// </returns>
    /// <exception cref="Exceptions.JamNotFoundException">
    /// Thrown when no active Jam matching <paramref name="jamCode"/> exists.
    /// </exception>
    Task<IReadOnlyList<PlayerSnapshot>> GetPlayers(string jamCode, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes the calling Player from their current Jam.
    /// If the Player was the Host and at least one Player remains, a random remaining
    /// Player is promoted to Host. If the Player was the sole member, the Jam is disposed.
    /// </summary>
    /// <param name="command">The command carrying the caller's ConnectionId.</param>
    /// <param name="cancellationToken">Token to observe for cancellation requests.</param>
    /// <returns>
    /// A <see cref="LeaveJamResult"/> containing the Jam code, whether the Jam is now empty,
    /// and the new Host's PlayerId if host promotion occurred.
    /// </returns>
    /// <exception cref="Exceptions.NotInJamException">
    /// Thrown when the player identified by <see cref="LeaveJamCommand.ConnectionId"/>
    /// is not currently associated with any active Jam.
    /// </exception>
    Task<LeaveJamResult> LeaveJam(LeaveJamCommand command, CancellationToken cancellationToken = default);

    /// <summary>
    /// Advances the Jam from the Lobby phase to the Submission phase.
    /// Only the Host may invoke this operation.
    /// </summary>
    /// <param name="command">The command carrying the caller's ConnectionId.</param>
    /// <param name="cancellationToken">Token to observe for cancellation requests.</param>
    /// <returns>
    /// An <see cref="AdvancePhaseResult"/> containing the Jam code and the name of the new phase,
    /// so the Hub can broadcast the phase change and identify the SignalR group.
    /// </returns>
    /// <exception cref="Exceptions.NotInJamException">
    /// Thrown when the player identified by <see cref="AdvancePhaseCommand.ConnectionId"/>
    /// is not currently associated with any active Jam.
    /// </exception>
    /// <exception cref="YtGuessWho.Domain.Exceptions.UnauthorizedHostActionException">
    /// Thrown when the caller is not the Host of the Jam.
    /// </exception>
    /// <exception cref="YtGuessWho.Domain.Exceptions.InvalidPhaseTransitionException">
    /// Thrown when the Jam is not in the Lobby phase.
    /// </exception>
    Task<AdvancePhaseResult> AdvancePhase(AdvancePhaseCommand command, CancellationToken cancellationToken = default);

    /// <summary>
    /// Records a Player's YouTube URL Submission for the current Jam.
    /// </summary>
    /// <param name="command">The command carrying the caller's ConnectionId and raw YouTube URL.</param>
    /// <param name="cancellationToken">Token to observe for cancellation requests.</param>
    /// <returns>
    /// A <see cref="SubmitSongResult"/> carrying the Jam code and whether all Players
    /// have now submitted, enabling the Hub to broadcast <c>AllSubmissionsReceived</c> if so.
    /// </returns>
    /// <exception cref="Exceptions.NotInJamException">
    /// Thrown when the player identified by <see cref="SubmitSongCommand.ConnectionId"/>
    /// is not currently associated with any active Jam.
    /// </exception>
    /// <exception cref="YtGuessWho.Domain.Exceptions.InvalidPhaseTransitionException">
    /// Thrown when the Jam is not in the Submission phase.
    /// </exception>
    /// <exception cref="YtGuessWho.Domain.Exceptions.AlreadySubmittedException">
    /// Thrown when the Player has already submitted a song in this Jam.
    /// </exception>
    /// <exception cref="YtGuessWho.Domain.Exceptions.InvalidYoutubeUrlException">
    /// Thrown when the provided URL does not match an accepted YouTube URL format.
    /// </exception>
    Task<SubmitSongResult> SubmitSong(SubmitSongCommand command, CancellationToken cancellationToken = default);
}

