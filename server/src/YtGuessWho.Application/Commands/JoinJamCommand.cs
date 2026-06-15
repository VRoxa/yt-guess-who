namespace YtGuessWho.Application.Commands;

/// <summary>
/// Command issued when a connected client requests to join an existing Jam.
/// </summary>
/// <param name="ConnectionId">
/// The SignalR ConnectionId of the requesting client. Becomes the Player's <c>PlayerId</c>.
/// </param>
/// <param name="JamCode">The invite code of the Jam to join.</param>
/// <param name="DisplayName">The display name chosen by the joining Player.</param>
public sealed record JoinJamCommand(string ConnectionId, string JamCode, string DisplayName);

