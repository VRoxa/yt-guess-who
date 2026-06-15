using YtGuessWho.Domain.Aggregates;

namespace YtGuessWho.Application.Repositories;

/// <summary>
/// Persistence contract for <see cref="Jam"/> aggregates.
/// Implementations are provided by the Infrastructure layer.
/// </summary>
public interface IJamRepository
{
    /// <summary>Stores a newly created <see cref="Jam"/>.</summary>
    /// <param name="jam">The Jam to persist. Must not be <c>null</c>.</param>
    void Add(Jam jam);

    /// <summary>
    /// Returns the <see cref="Jam"/> identified by <paramref name="code"/>,
    /// or <c>null</c> if no Jam with that code exists.
    /// </summary>
    /// <param name="code">The Jam's invite code string.</param>
    Jam? FindByCode(string code);

    /// <summary>
    /// Returns the <see cref="Jam"/> that contains a <see cref="YtGuessWho.Domain.Entities.Player"/>
    /// with the given <paramref name="playerId"/>, or <c>null</c> if the player is not in any Jam.
    /// </summary>
    /// <param name="playerId">The player's SignalR ConnectionId.</param>
    Jam? FindByPlayerId(string playerId);

    /// <summary>
    /// Removes the <see cref="Jam"/> identified by <paramref name="jamCode"/> from the store.
    /// This method is a no-op if no Jam with the given code exists.
    /// </summary>
    /// <param name="jamCode">The invite code of the Jam to remove.</param>
    void Remove(string jamCode);
}

