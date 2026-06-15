using FakeItEasy;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using YtGuessWho.Application.Exceptions;
using YtGuessWho.Application.Repositories;
using YtGuessWho.Application.Services.Implementations;
using YtGuessWho.Domain.Aggregates;

namespace YtGuessWho.Tests.Application;

/// <summary>
/// Unit tests for <see cref="JamService.GetPlayers"/>.
/// </summary>
public sealed class JamServiceGetPlayersTests
{
    private readonly IJamRepository _repository;
    private readonly JamService _sut;

    public JamServiceGetPlayersTests()
    {
        _repository = A.Fake<IJamRepository>();
        var logger = A.Fake<ILogger<JamService>>();
        _sut = new JamService(_repository, logger);
    }

    [Fact]
    public async Task GetPlayers_WhenJamHasOnePlayer_ReturnsOneSnapshot()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        A.CallTo(() => _repository.FindByCode("ABCDEF")).Returns(jam);

        // Act
        var result = await _sut.GetPlayers("ABCDEF");

        // Assert
        result.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetPlayers_WhenJamHasOnePlayer_SnapshotHasCorrectPlayerId()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        A.CallTo(() => _repository.FindByCode("ABCDEF")).Returns(jam);

        // Act
        var result = await _sut.GetPlayers("ABCDEF");

        // Assert
        result[0].PlayerId.Should().Be("host-conn");
    }

    [Fact]
    public async Task GetPlayers_WhenJamHasOnePlayer_SnapshotHasCorrectDisplayName()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        A.CallTo(() => _repository.FindByCode("ABCDEF")).Returns(jam);

        // Act
        var result = await _sut.GetPlayers("ABCDEF");

        // Assert
        result[0].DisplayName.Should().Be("Alice");
    }

    [Fact]
    public async Task GetPlayers_WhenJamHasOnePlayer_HostSnapshotHasIsHostTrue()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        A.CallTo(() => _repository.FindByCode("ABCDEF")).Returns(jam);

        // Act
        var result = await _sut.GetPlayers("ABCDEF");

        // Assert
        result[0].IsHost.Should().BeTrue();
    }

    [Fact]
    public async Task GetPlayers_WhenJamHasTwoPlayers_NonHostSnapshotHasIsHostFalse()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("joiner-conn", "Bob");
        A.CallTo(() => _repository.FindByCode("ABCDEF")).Returns(jam);

        // Act
        var result = await _sut.GetPlayers("ABCDEF");

        // Assert
        result[1].IsHost.Should().BeFalse();
    }

    [Fact]
    public async Task GetPlayers_WhenJamHasTwoPlayers_ReturnsTwoSnapshotsInJoinOrder()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("joiner-conn", "Bob");
        A.CallTo(() => _repository.FindByCode("ABCDEF")).Returns(jam);

        // Act
        var result = await _sut.GetPlayers("ABCDEF");

        // Assert
        result.Should().HaveCount(2);
        result[0].PlayerId.Should().Be("host-conn");
        result[1].PlayerId.Should().Be("joiner-conn");
    }

    [Fact]
    public async Task GetPlayers_WhenJamHasTwoPlayers_OnlyHostSnapshotHasIsHostTrue()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("joiner-conn", "Bob");
        A.CallTo(() => _repository.FindByCode("ABCDEF")).Returns(jam);

        // Act
        var result = await _sut.GetPlayers("ABCDEF");

        // Assert
        result.Where(p => p.IsHost).Should().HaveCount(1);
        result.Single(p => p.IsHost).PlayerId.Should().Be("host-conn");
    }

    [Fact]
    public async Task GetPlayers_WhenJamCodeDoesNotExist_ThrowsJamNotFoundException()
    {
        // Arrange
        A.CallTo(() => _repository.FindByCode("ZZZZZZ")).Returns(null);

        // Act
        var act = async () => await _sut.GetPlayers("ZZZZZZ");

        // Assert
        await act.Should().ThrowAsync<JamNotFoundException>();
    }

    [Fact]
    public async Task GetPlayers_WithNullJamCode_ThrowsArgumentNullException()
    {
        // Arrange & Act
        var act = async () => await _sut.GetPlayers(null!);

        // Assert
        await act.Should().ThrowAsync<ArgumentNullException>();
    }
}

