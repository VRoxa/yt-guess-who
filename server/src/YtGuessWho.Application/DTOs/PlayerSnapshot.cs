namespace YtGuessWho.Application.DTOs;

/// <summary>
/// Immutable snapshot of a Player's identity, returned by Application queries.
/// </summary>
/// <remarks>
/// Carries Player data across the Application layer boundary without exposing
/// the <see cref="YtGuessWho.Domain.Entities.Player"/> domain entity to callers.
/// </remarks>
/// <param name="PlayerId">The SignalR ConnectionId that uniquely identifies the Player.</param>
/// <param name="DisplayName">The display name chosen by the Player.</param>
/// <param name="IsHost">Whether this Player is the Host of the Jam.</param>
public sealed record PlayerSnapshot(
    string PlayerId,
    string DisplayName,
    bool IsHost);

