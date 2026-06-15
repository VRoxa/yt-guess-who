namespace YtGuessWho.Domain.Extensions;

/// <summary>
/// Contains all instance-level business logic for <see cref="YtGuessWho.Domain.Entities.Player"/>.
/// </summary>
/// <remarks>
/// <see cref="YtGuessWho.Domain.Entities.Player"/> is a pure data class; this companion file is
/// the sole location for domain operations that take a <c>Player</c> as their subject.
/// See <c>docs/guidelines/csharp-coding-standards.md §2.15</c> for the rationale.
/// </remarks>
public static class PlayerExtensions
{
    /// <summary>
    /// Promotes this Player to the Host role by setting <c>IsHost</c> to <c>true</c>.
    /// </summary>
    /// <param name="player">The Player to promote.</param>
    /// <exception cref="ArgumentNullException">
    /// Thrown when <paramref name="player"/> is <c>null</c>.
    /// </exception>
    public static void PromoteToHost(this Entities.Player player)
    {
        ArgumentNullException.ThrowIfNull(player);

        player.IsHost = true;
    }
}

