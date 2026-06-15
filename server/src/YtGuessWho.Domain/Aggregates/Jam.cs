using YtGuessWho.Domain.Entities;
using YtGuessWho.Domain.Enums;
using YtGuessWho.Domain.ValueObjects;

namespace YtGuessWho.Domain.Aggregates;

/// <summary>
/// Aggregate root representing a single game session.
/// </summary>
/// <remarks>
/// All business invariants for the Jam lifecycle are enforced inside the methods of this class.
/// No invariant logic may exist in hubs, services, or controllers — only here.
/// Domain model fields are defined in <c>docs/context.md — Domain Model</c>.
/// </remarks>
public sealed class Jam
{
    private readonly List<Player> _players;

    /// <summary>The short invite code that uniquely identifies this Jam.</summary>
    public JamCode JamCode { get; }

    /// <summary>The current phase of this Jam.</summary>
    public JamPhase Phase { get; private set; }

    /// <summary>
    /// The read-only list of Players currently in this Jam.
    /// The Host is always the first entry (index 0).
    /// </summary>
    public IReadOnlyList<Player> Players => _players;

    private Jam(JamCode jamCode, Player host)
    {
        JamCode = jamCode;
        Phase = JamPhase.Lobby;
        _players = [host];
    }

    /// <summary>
    /// Creates a new <see cref="Jam"/> in the <see cref="JamPhase.Lobby"/> phase,
    /// generating a random <see cref="JamCode"/> and registering the creator as the Host.
    /// </summary>
    /// <param name="connectionId">
    /// The SignalR ConnectionId of the creating client. Becomes the Host's <c>PlayerId</c>.
    /// </param>
    /// <param name="displayName">The display name chosen by the Host.</param>
    /// <returns>A new <see cref="Jam"/> containing exactly one <see cref="Player"/> (the Host).</returns>
    /// <exception cref="ArgumentNullException">
    /// Thrown when <paramref name="connectionId"/> or <paramref name="displayName"/> is <c>null</c>.
    /// </exception>
    public static Jam CreateNew(string connectionId, string displayName)
    {
        ArgumentNullException.ThrowIfNull(connectionId);
        ArgumentNullException.ThrowIfNull(displayName);

        var code = JamCode.Generate();
        var host = new Player(connectionId, displayName, isHost: true);

        return new Jam(code, host);
    }
}

