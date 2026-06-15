using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using YtGuessWho.Application.Commands;
using YtGuessWho.Application.Exceptions;
using YtGuessWho.Application.Services;
using YtGuessWho.Domain.Exceptions;
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

            var players = await _jamService.GetPlayers(jamCode, Context.ConnectionAborted);

            foreach (var player in players)
            {
                await Clients.Caller.PlayerJoined(new PlayerJoinedPayload(
                    player.PlayerId,
                    player.DisplayName,
                    player.IsHost));
            }

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

    /// <summary>
    /// Adds the calling Player to an existing Jam identified by its invite code.
    /// </summary>
    /// <param name="jamCode">The invite code of the Jam to join.</param>
    /// <param name="displayName">The display name chosen by the joining Player.</param>
    /// <remarks>
    /// On success: the caller is added to the SignalR group keyed by the Jam code.
    /// On error: an <c>Error</c> event is sent to the caller and a <see cref="HubException"/>
    /// is thrown so the client's <c>invoke()</c> Promise rejects with the error code.
    /// </remarks>
    /// <exception cref="HubException">
    /// Thrown (after sending <c>Error</c> to the caller) for <c>ALREADY_IN_JAM</c>,
    /// <c>JAM_NOT_FOUND</c>, and <c>JAM_NOT_JOINABLE</c> conditions.
    /// </exception>
    public async Task JoinJam(string jamCode, string displayName)
    {
        try
        {
            await _jamService.JoinJam(
                new JoinJamCommand(Context.ConnectionId, jamCode, displayName),
                Context.ConnectionAborted);

            await Groups.AddToGroupAsync(Context.ConnectionId, jamCode, Context.ConnectionAborted);

            var players = await _jamService.GetPlayers(jamCode, Context.ConnectionAborted);

            foreach (var player in players)
            {
                await Clients.Caller.PlayerJoined(new PlayerJoinedPayload(
                    player.PlayerId,
                    player.DisplayName,
                    player.IsHost));
            }

            // Broadcast only the new player to existing members so they don't receive a duplicate.
            var joiner = players.First(p => p.PlayerId == Context.ConnectionId);

            await Clients.GroupExcept(jamCode, [Context.ConnectionId]).PlayerJoined(new PlayerJoinedPayload(
                joiner.PlayerId,
                joiner.DisplayName,
                joiner.IsHost));

            _logger.LogInformation(
                "Player joined Jam {JamCode}. ConnectionId: {ConnectionId}",
                jamCode,
                Context.ConnectionId);
        }
        catch (PlayerAlreadyInJamException)
        {
            _logger.LogWarning(
                "ALREADY_IN_JAM: connection {ConnectionId} attempted to join Jam {JamCode} while already in a Jam.",
                Context.ConnectionId,
                jamCode);

            await Clients.Caller.Error(new ErrorPayload("ALREADY_IN_JAM", "You are already in an active Jam."));
            throw new HubException("ALREADY_IN_JAM");
        }
        catch (JamNotFoundException)
        {
            _logger.LogWarning(
                "JAM_NOT_FOUND: connection {ConnectionId} attempted to join non-existent Jam {JamCode}.",
                Context.ConnectionId,
                jamCode);

            await Clients.Caller.Error(new ErrorPayload("JAM_NOT_FOUND", $"No Jam with code '{jamCode}' was found."));
            throw new HubException("JAM_NOT_FOUND");
        }
        catch (JamNotJoinableException)
        {
            _logger.LogWarning(
                "JAM_NOT_JOINABLE: connection {ConnectionId} attempted to join Jam {JamCode} which is not in Lobby phase.",
                Context.ConnectionId,
                jamCode);

            await Clients.Caller.Error(new ErrorPayload("JAM_NOT_JOINABLE", "This Jam is no longer accepting new players."));
            throw new HubException("JAM_NOT_JOINABLE");
        }
    }

    /// <summary>
    /// Removes the calling Player from their current Jam, notifies remaining group members,
    /// and resets the caller's group membership.
    /// </summary>
    /// <remarks>
    /// On success: the caller is removed from the SignalR group, a <c>PlayerLeft</c> event is
    /// broadcast to remaining members, and a <c>HostChanged</c> event is broadcast if the
    /// departing Player was the Host.
    /// On <c>NOT_IN_JAM</c>: an <c>Error</c> event is sent exclusively to the caller and a
    /// <see cref="HubException"/> is thrown so the client's <c>invoke()</c> Promise rejects.
    /// </remarks>
    /// <exception cref="HubException">
    /// Thrown (after sending <c>Error</c> to the caller) when the caller is not in any active Jam.
    /// </exception>
    public async Task LeaveJam()
    {
        try
        {
            var result = await _jamService.LeaveJam(
                new LeaveJamCommand(Context.ConnectionId),
                Context.ConnectionAborted);

            // Remove the caller from the group BEFORE broadcasting so they do not receive
            // the PlayerLeft event for themselves.
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, result.JamCode, Context.ConnectionAborted);

            if (!result.JamIsEmpty)
            {
                await Clients.Group(result.JamCode).PlayerLeft(new PlayerLeftPayload(Context.ConnectionId));

                if (result.NewHostPlayerId is not null)
                {
                    await Clients.Group(result.JamCode).HostChanged(new HostChangedPayload(result.NewHostPlayerId));
                }
            }

            _logger.LogInformation(
                "Player left Jam {JamCode}. ConnectionId: {ConnectionId}",
                result.JamCode,
                Context.ConnectionId);
        }
        catch (NotInJamException)
        {
            _logger.LogWarning(
                "NOT_IN_JAM: connection {ConnectionId} attempted to leave a Jam while not in one.",
                Context.ConnectionId);

            await Clients.Caller.Error(new ErrorPayload("NOT_IN_JAM", "You are not currently in a Jam."));
            throw new HubException("NOT_IN_JAM");
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
    /// Triggered on both graceful and abrupt disconnects. Removes the Player from their active
    /// Jam (if any) and broadcasts <c>PlayerLeft</c> and, where applicable, <c>HostChanged</c>
    /// to remaining group members. SignalR automatically removes the connection from all groups
    /// on disconnect — <c>Groups.RemoveFromGroupAsync</c> is deliberately not called here.
    /// If the Player was not in any Jam, the <see cref="NotInJamException"/> is silently
    /// swallowed (this is a normal path for connections that never joined a Jam).
    /// </remarks>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception is null)
        {
            _logger.LogInformation(
                "Player disconnected gracefully. ConnectionId: {ConnectionId}",
                Context.ConnectionId);
        }
        else
        {
            _logger.LogWarning(
                exception,
                "Player disconnected abruptly. ConnectionId: {ConnectionId}",
                Context.ConnectionId);
        }

        try
        {
            // No CancellationToken — the connection is already closing.
            var result = await _jamService.LeaveJam(new LeaveJamCommand(Context.ConnectionId));

            if (!result.JamIsEmpty)
            {
                await Clients.Group(result.JamCode).PlayerLeft(new PlayerLeftPayload(Context.ConnectionId));

                if (result.NewHostPlayerId is not null)
                {
                    await Clients.Group(result.JamCode).HostChanged(new HostChangedPayload(result.NewHostPlayerId));
                }
            }

            _logger.LogInformation(
                "Disconnect cleanup complete. JamCode: {JamCode}, ConnectionId: {ConnectionId}",
                result.JamCode,
                Context.ConnectionId);
        }
        catch (NotInJamException)
        {
            // Normal path — the connection closed before the player joined any Jam.
            _logger.LogDebug(
                "Disconnected player {ConnectionId} was not in any Jam — no cleanup required.",
                Context.ConnectionId);
        }

        await base.OnDisconnectedAsync(exception);
    }
}
