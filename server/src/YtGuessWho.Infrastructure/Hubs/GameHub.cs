using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace YtGuessWho.Infrastructure.Hubs;

/// <summary>
/// SignalR hub that handles real-time communication between the server and connected Players.
/// This class is the sole boundary between the WebSocket transport and the application core.
/// </summary>
/// <remarks>
/// Hub design constraints are defined in <c>docs/realtime-communication.md — Hub Design</c>.
/// <list type="bullet">
///   <item>No domain logic is enforced here — invariants live in the Domain layer.</item>
///   <item>No SignalR types cross into Application or Domain.</item>
///   <item>Errors are sent exclusively to the caller, never broadcast to the group.</item>
///   <item>The SignalR <c>ConnectionId</c> is the Player's identity for the connection lifetime.</item>
/// </list>
/// </remarks>
public sealed class GameHub : Hub<IGameHubClient>
{
    private readonly ILogger<GameHub> _logger;

    /// <summary>
    /// Initialises a new instance of <see cref="GameHub"/>.
    /// </summary>
    /// <param name="logger">Structured logger injected by the DI container.</param>
    public GameHub(ILogger<GameHub> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    /// <remarks>
    /// A raw WebSocket connection has been established. No game state is created or mutated here.
    /// The <c>ConnectionId</c> is available but is not yet associated with any Jam.
    /// Jam association happens when the client subsequently calls <c>CreateJam</c> or <c>JoinJam</c>.
    /// </remarks>
    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation(
            "Player connected. ConnectionId: {ConnectionId}",
            Context.ConnectionId);

        await base.OnConnectedAsync();
    }

    /// <inheritdoc />
    /// <remarks>
    /// Triggered on both graceful and abrupt disconnects. Full Jam cleanup (removing the Player,
    /// broadcasting <c>PlayerLeft</c>, handling Host disconnection) is deferred until the
    /// Application layer services are available in a subsequent ticket.
    /// </remarks>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception is null)
        {
            _logger.LogInformation(
                "Player disconnected gracefully. ConnectionId: {ConnectionId}",
                Context.ConnectionId);

            await base.OnDisconnectedAsync(exception);
            return;
        }

        _logger.LogWarning(
            exception,
            "Player disconnected abruptly. ConnectionId: {ConnectionId}",
            Context.ConnectionId);

        await base.OnDisconnectedAsync(exception);
    }
}

