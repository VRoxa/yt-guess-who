using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using YtGuessWho.Application.Commands;
using YtGuessWho.Application.Exceptions;
using YtGuessWho.Application.Services;
using YtGuessWho.Infrastructure.Hubs.Payloads;

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
    private readonly IJamService _jamService;
    private readonly ILogger<GameHub> _logger;

    /// <summary>
    /// Initialises a new instance of <see cref="GameHub"/>.
    /// </summary>
    /// <param name="jamService">Application service that orchestrates Jam lifecycle use-cases.</param>
    /// <param name="logger">Structured logger injected by the DI container.</param>
    public GameHub(IJamService jamService, ILogger<GameHub> logger)
    {
        _jamService = jamService;
        _logger = logger;
    }

    /// <summary>
    /// Creates a new Jam, registers the caller as the Host, and returns the Jam code.
    /// </summary>
    /// <param name="displayName">The display name chosen by the Host.</param>
    /// <returns>
    /// The generated Jam code string on success, or <see cref="string.Empty"/> when the caller
    /// is already in a Jam (in which case an <c>Error</c> event is sent to the caller instead).
    /// </returns>
    /// <remarks>
    /// On success: the caller is added to the SignalR group keyed by the Jam code, and a
    /// <c>PlayerJoined</c> event is broadcast to the group.
    /// On <c>ALREADY_IN_JAM</c>: an <c>Error</c> event is sent exclusively to the caller;
    /// the exception is not propagated.
    /// </remarks>
    public async Task<string> CreateJam(string displayName)
    {
        try
        {
            var jamCode = await _jamService.CreateJam(
                new CreateJamCommand(Context.ConnectionId, displayName),
                Context.ConnectionAborted);

            await Groups.AddToGroupAsync(Context.ConnectionId, jamCode, Context.ConnectionAborted);

            await Clients.Group(jamCode).PlayerJoined(new PlayerJoinedPayload(
                Context.ConnectionId,
                displayName,
                IsHost: true));

            _logger.LogInformation(
                "Jam {JamCode} created by connection {ConnectionId}",
                jamCode,
                Context.ConnectionId);

            return jamCode;
        }
        catch (PlayerAlreadyInJamException)
        {
            _logger.LogWarning(
                "ALREADY_IN_JAM: connection {ConnectionId} attempted to create a Jam while already in one.",
                Context.ConnectionId);

            await Clients.Caller.Error(new ErrorPayload(
                "ALREADY_IN_JAM",
                "You are already in an active Jam."));

            return string.Empty;
        }
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
