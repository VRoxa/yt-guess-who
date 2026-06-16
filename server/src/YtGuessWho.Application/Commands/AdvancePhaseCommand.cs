namespace YtGuessWho.Application.Commands;

/// <summary>
/// Command issued when the Host requests to advance the Jam to the next phase.
/// </summary>
/// <param name="ConnectionId">The SignalR ConnectionId of the requesting Player.</param>
public sealed record AdvancePhaseCommand(string ConnectionId);

