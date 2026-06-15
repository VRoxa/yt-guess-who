using Microsoft.Extensions.Logging;
using YtGuessWho.Application.Commands;
using YtGuessWho.Application.Exceptions;
using YtGuessWho.Application.Repositories;
using YtGuessWho.Domain.Aggregates;

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
}

