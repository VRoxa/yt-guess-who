using Microsoft.Extensions.Logging;
using YtGuessWho.Application.Commands;
using YtGuessWho.Application.DTOs;
using YtGuessWho.Application.Exceptions;
using YtGuessWho.Application.Repositories;
using YtGuessWho.Domain.Aggregates;
using YtGuessWho.Domain.Enums;
using YtGuessWho.Domain.Exceptions;
using YtGuessWho.Domain.Extensions;

namespace YtGuessWho.Application.Services.Implementations;

/// <summary>
/// Default implementation of <see cref="IJamService"/>.
/// Orchestrates Jam creation and joining by coordinating the Domain aggregate and the repository.
/// </summary>
internal sealed class JamService : IJamService
{
    private readonly IJamRepository _repository;
    private readonly ILogger<JamService> _logger;

    /// <summary>
    /// Initialises a new <see cref="JamService"/>.
    /// </summary>
    /// <param name="repository">Repository used to store and retrieve Jams.</param>
    /// <param name="logger">Structured logger.</param>
    public JamService(IJamRepository repository, ILogger<JamService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    /// <inheritdoc />
    public Task<string> CreateJam(CreateJamCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var existingJam = _repository.FindByPlayerId(command.ConnectionId);

        if (existingJam is not null)
        {
            throw new PlayerAlreadyInJamException(command.ConnectionId);
        }

        var jam = Jam.CreateNew(command.ConnectionId, command.DisplayName);

        _repository.Add(jam);

        _logger.LogInformation(
            "Jam created. JamCode: {JamCode}, Host ConnectionId: {ConnectionId}",
            jam.JamCode.Value,
            command.ConnectionId);

        return Task.FromResult(jam.JamCode.Value);
    }

    /// <inheritdoc />
    public Task JoinJam(JoinJamCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var existingJam = _repository.FindByPlayerId(command.ConnectionId);

        if (existingJam is not null)
        {
            throw new PlayerAlreadyInJamException(command.ConnectionId);
        }

        var jam = _repository.FindByCode(command.JamCode);

        if (jam is null)
        {
            throw new JamNotFoundException(command.JamCode);
        }

        // JamNotJoinableException propagates naturally from the domain if Phase != Lobby.
        jam.AddPlayer(command.ConnectionId, command.DisplayName);

        _logger.LogInformation(
            "Player joined Jam. JamCode: {JamCode}, ConnectionId: {ConnectionId}",
            command.JamCode,
            command.ConnectionId);

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<PlayerSnapshot>> GetPlayers(string jamCode, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(jamCode);

        var jam = _repository.FindByCode(jamCode);

        if (jam is null)
        {
            throw new JamNotFoundException(jamCode);
        }

        IReadOnlyList<PlayerSnapshot> snapshots = jam.Players
            .Select(p => new PlayerSnapshot(p.PlayerId, p.DisplayName, p.IsHost))
            .ToList();

        _logger.LogDebug(
            "GetPlayers called for Jam {JamCode}. PlayerCount: {Count}",
            jamCode,
            snapshots.Count);

        return Task.FromResult(snapshots);
    }

    /// <inheritdoc />
    public Task<LeaveJamResult> LeaveJam(LeaveJamCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var jam = _repository.FindByPlayerId(command.ConnectionId);

        if (jam is null)
        {
            throw new NotInJamException(command.ConnectionId);
        }

        var previousHostId = jam.Players.FirstOrDefault(p => p.IsHost)?.PlayerId;

        jam.RemovePlayer(command.ConnectionId);

        if (jam.Players.Count == 0)
        {
            _repository.Remove(jam.JamCode.Value);

            _logger.LogInformation(
                "Player left Jam and Jam was disposed. JamCode: {JamCode}, ConnectionId: {ConnectionId}",
                jam.JamCode.Value,
                command.ConnectionId);

            return Task.FromResult(new LeaveJamResult(jam.JamCode.Value, true, null));
        }

        var newHostId = jam.Players.FirstOrDefault(p => p.IsHost)?.PlayerId;
        var promotedHostId = previousHostId == command.ConnectionId ? newHostId : null;

        _logger.LogInformation(
            "Player left Jam. JamCode: {JamCode}, ConnectionId: {ConnectionId}, JamIsEmpty: false, NewHostPlayerId: {NewHostPlayerId}",
            jam.JamCode.Value,
            command.ConnectionId,
            promotedHostId ?? "(no change)");

        return Task.FromResult(new LeaveJamResult(jam.JamCode.Value, false, promotedHostId));
    }

    /// <inheritdoc />
    public Task<AdvancePhaseResult> AdvancePhase(AdvancePhaseCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var jam = _repository.FindByPlayerId(command.ConnectionId);

        if (jam is null)
        {
            throw new NotInJamException(command.ConnectionId);
        }

        // UnauthorizedHostActionException and InvalidPhaseTransitionException propagate naturally.
        jam.AdvancePhase(command.ConnectionId);

        _logger.LogInformation(
            "Phase advanced. JamCode: {JamCode}, NewPhase: {NewPhase}, ConnectionId: {ConnectionId}",
            jam.JamCode.Value,
            jam.Phase,
            command.ConnectionId);

        return Task.FromResult(new AdvancePhaseResult(jam.JamCode.Value, jam.Phase.ToString()));
    }

    /// <inheritdoc />
    public Task<SubmitSongResult> SubmitSong(SubmitSongCommand command, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var jam = _repository.FindByPlayerId(command.ConnectionId);

        if (jam is null)
        {
            throw new NotInJamException(command.ConnectionId);
        }

        if (jam.Phase != JamPhase.Submission)
        {
            throw new InvalidPhaseTransitionException(jam.Phase);
        }

        var player = jam.Players.FirstOrDefault(p => p.PlayerId == command.ConnectionId);

        if (player is null)
        {
            throw new NotInJamException(command.ConnectionId);
        }

        // AlreadySubmittedException and InvalidYoutubeUrlException propagate naturally.
        player.SubmitSong(command.YoutubeUrl);

        var allSubmissionsReceived = jam.Players.All(p => p.Submission is not null);

        _logger.LogInformation(
            "Song submitted. JamCode: {JamCode}, ConnectionId: {ConnectionId}, AllSubmissionsReceived: {AllSubmissionsReceived}",
            jam.JamCode.Value,
            command.ConnectionId,
            allSubmissionsReceived);

        return Task.FromResult(new SubmitSongResult(jam.JamCode.Value, allSubmissionsReceived));
    }
}

