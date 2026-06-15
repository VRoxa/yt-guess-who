namespace YtGuessWho.Domain.Entities;

/// <summary>
/// Represents a human participant connected to a <see cref="YtGuessWho.Domain.Aggregates.Jam"/>.
/// </summary>
/// <remarks>
/// The <see cref="PlayerId"/> is the SignalR <c>ConnectionId</c> for the duration of the connection,
/// as defined in <c>docs/realtime-communication.md — Rules for Implementors, rule 6</c>.
/// </remarks>
public sealed class Player
{
    /// <summary>
    /// The unique identifier for this Player. Equals the SignalR <c>ConnectionId</c>
    /// for the lifetime of the WebSocket connection.
    /// </summary>
    public string PlayerId { get; }

    /// <summary>The display name chosen by the Player when joining or creating a Jam.</summary>
    public string DisplayName { get; }

    /// <summary>
    /// Whether this Player is the Host of the Jam — i.e. the Player who created it.
    /// Only one Player per Jam may have <c>IsHost = true</c>.
    /// </summary>
    public bool IsHost { get; private set; }

    /// <summary>
    /// The cumulative Score accumulated by this Player across all completed Rounds.
    /// Starts at <c>0</c> and increases as Rounds resolve.
    /// </summary>
    public int Score { get; private set; }

    /// <summary>
    /// The YouTube URL submitted by this Player during the Submission phase.
    /// <c>null</c> until the Player submits.
    /// Will be replaced by a typed <c>YoutubeUrl</c> value object in a later ticket.
    /// </summary>
    public string? Submission { get; private set; }

    /// <summary>
    /// Initialises a new <see cref="Player"/>.
    /// </summary>
    /// <param name="playerId">The SignalR ConnectionId that identifies this Player.</param>
    /// <param name="displayName">The human-readable name chosen by the Player.</param>
    /// <param name="isHost">Whether this Player is the Jam Host.</param>
    /// <exception cref="ArgumentNullException">
    /// Thrown when <paramref name="playerId"/> or <paramref name="displayName"/> is <c>null</c>.
    /// </exception>
    public Player(string playerId, string displayName, bool isHost)
    {
        ArgumentNullException.ThrowIfNull(playerId);
        ArgumentNullException.ThrowIfNull(displayName);

        PlayerId = playerId;
        DisplayName = displayName;
        IsHost = isHost;
    }

    /// <summary>
    /// Promotes this Player to Host status.
    /// Called exclusively by <see cref="YtGuessWho.Domain.Aggregates.Jam.RemovePlayer"/>
    /// when the departing Player held the Host role and at least one Player remains.
    /// </summary>
    internal void PromoteToHost() => IsHost = true;
}

