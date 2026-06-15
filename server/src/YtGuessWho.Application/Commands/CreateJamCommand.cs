namespace YtGuessWho.Application.Commands;

/// <summary>
/// Command issued when a connected client requests to create a new Jam.
/// </summary>
/// <param name="ConnectionId">
/// The SignalR ConnectionId of the requesting client. Becomes the Host's <c>PlayerId</c>.
/// </param>
/// <param name="DisplayName">The display name chosen by the Host.</param>
public sealed record CreateJamCommand(string ConnectionId, string DisplayName);

