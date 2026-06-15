namespace YtGuessWho.Application.Commands;

/// <summary>
/// Command issued when a Player explicitly leaves a Jam.
/// </summary>
/// <param name="ConnectionId">The SignalR ConnectionId of the leaving Player.</param>
public sealed record LeaveJamCommand(string ConnectionId);

