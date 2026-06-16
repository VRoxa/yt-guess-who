using YtGuessWho.Domain.Entities;
using YtGuessWho.Domain.Enums;
using YtGuessWho.Domain.Exceptions;

namespace YtGuessWho.Domain.Extensions;

/// <summary>
/// Contains all instance-level business logic for <see cref="YtGuessWho.Domain.Aggregates.Jam"/>.
/// </summary>
/// <remarks>
/// <see cref="YtGuessWho.Domain.Aggregates.Jam"/> is a pure data class; this companion file is
/// the sole location for domain operations that take a <c>Jam</c> as their subject.
/// Extension methods access <c>Jam.InternalPlayers</c> and <c>Jam.Phase</c>
/// (both <c>internal</c>) to mutate state, keeping mutation logic out of the data class entirely.
/// See <c>docs/guidelines/csharp-coding-standards.md §2.15</c> for the rationale.
/// </remarks>
public static class JamExtensions
{
    private static readonly Random _random = new();

    /// <summary>
    /// Adds a new non-host <see cref="Player"/> to the Jam.
    /// </summary>
    /// <param name="jam">The Jam to add the player to.</param>
    /// <param name="connectionId">
    /// The SignalR ConnectionId of the joining client. Becomes the Player's <c>PlayerId</c>.
    /// </param>
    /// <param name="displayName">The display name chosen by the joining Player.</param>
    /// <exception cref="ArgumentNullException">
    /// Thrown when <paramref name="jam"/>, <paramref name="connectionId"/>,
    /// or <paramref name="displayName"/> is <c>null</c>.
    /// </exception>
    /// <exception cref="JamNotJoinableException">
    /// Thrown when the Jam is not in <see cref="JamPhase.Lobby"/> phase.
    /// </exception>
    public static void AddPlayer(this Aggregates.Jam jam, string connectionId, string displayName)
    {
        ArgumentNullException.ThrowIfNull(jam);
        ArgumentNullException.ThrowIfNull(connectionId);
        ArgumentNullException.ThrowIfNull(displayName);

        if (jam.Phase != JamPhase.Lobby)
        {
            throw new JamNotJoinableException(jam.Phase);
        }

        jam.InternalPlayers.Add(new Player(connectionId, displayName, isHost: false));
    }

    /// <summary>
    /// Removes the <see cref="Player"/> identified by <paramref name="connectionId"/> from the Jam.
    /// If the removed Player was the Host and at least one Player remains, a random remaining
    /// Player is promoted to Host.
    /// </summary>
    /// <param name="jam">The Jam to remove the player from.</param>
    /// <param name="connectionId">The SignalR ConnectionId of the Player to remove.</param>
    /// <exception cref="ArgumentNullException">
    /// Thrown when <paramref name="jam"/> or <paramref name="connectionId"/> is <c>null</c>.
    /// </exception>
    public static void RemovePlayer(this Aggregates.Jam jam, string connectionId)
    {
        ArgumentNullException.ThrowIfNull(jam);
        ArgumentNullException.ThrowIfNull(connectionId);

        var player = jam.InternalPlayers.FirstOrDefault(p => p.PlayerId == connectionId);

        if (player is null)
        {
            return;
        }

        var wasHost = player.IsHost;
        jam.InternalPlayers.Remove(player);

        if (wasHost && jam.InternalPlayers.Count > 0)
        {
            jam.InternalPlayers[_random.Next(jam.InternalPlayers.Count)].PromoteToHost();
        }
    }

    /// <summary>
    /// Advances the Jam from the <see cref="JamPhase.Lobby"/> phase to the
    /// <see cref="JamPhase.Submission"/> phase.
    /// </summary>
    /// <param name="jam">The Jam to advance.</param>
    /// <param name="requestingPlayerId">The ConnectionId of the Player requesting the advance.</param>
    /// <exception cref="ArgumentNullException">
    /// Thrown when <paramref name="jam"/> or <paramref name="requestingPlayerId"/> is <c>null</c>.
    /// </exception>
    /// <exception cref="UnauthorizedHostActionException">
    /// Thrown when the Player identified by <paramref name="requestingPlayerId"/> is not the Host.
    /// </exception>
    /// <exception cref="InvalidPhaseTransitionException">
    /// Thrown when the Jam is not currently in the <see cref="JamPhase.Lobby"/> phase.
    /// </exception>
    public static void AdvancePhase(this Aggregates.Jam jam, string requestingPlayerId)
    {
        ArgumentNullException.ThrowIfNull(jam);
        ArgumentNullException.ThrowIfNull(requestingPlayerId);

        if (jam.Phase != JamPhase.Lobby)
        {
            throw new InvalidPhaseTransitionException(jam.Phase);
        }

        var requestingPlayer = jam.Players.FirstOrDefault(p => p.PlayerId == requestingPlayerId);

        if (requestingPlayer is null || !requestingPlayer.IsHost)
        {
            throw new UnauthorizedHostActionException(requestingPlayerId);
        }

        jam.Phase = JamPhase.Submission;
    }
}

