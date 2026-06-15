using System.Collections.Concurrent;
using YtGuessWho.Application.Repositories;
using YtGuessWho.Domain.Aggregates;

namespace YtGuessWho.Infrastructure.Repositories;

/// <summary>
/// In-memory implementation of <see cref="IJamRepository"/>.
/// Uses a <see cref="ConcurrentDictionary{TKey,TValue}"/> keyed by <c>JamCode</c>
/// to safely serve concurrent SignalR connections.
/// </summary>
/// <remarks>
/// Registered as <c>SingleInstance</c> so the same dictionary survives the full process lifetime.
/// Thread-safety requirements are noted in <c>docs/solution-architecture.md — Cross-Cutting Concerns</c>.
/// </remarks>
internal sealed class InMemoryJamRepository : IJamRepository
{
    private readonly ConcurrentDictionary<string, Jam> _jams = new();

    /// <inheritdoc />
    public void Add(Jam jam)
    {
        ArgumentNullException.ThrowIfNull(jam);

        _jams[jam.JamCode.Value] = jam;
    }

    /// <inheritdoc />
    public Jam? FindByCode(string code)
    {
        ArgumentNullException.ThrowIfNull(code);

        return _jams.TryGetValue(code, out var jam) ? jam : null;
    }

    /// <inheritdoc />
    public Jam? FindByPlayerId(string playerId)
    {
        ArgumentNullException.ThrowIfNull(playerId);

        foreach (var jam in _jams.Values)
        {
            foreach (var player in jam.Players)
            {
                if (player.PlayerId == playerId)
                {
                    return jam;
                }
            }
        }

        return null;
    }

    /// <inheritdoc />
    public void Remove(string jamCode)
    {
        ArgumentNullException.ThrowIfNull(jamCode);

        _jams.TryRemove(jamCode, out _);
    }
}

