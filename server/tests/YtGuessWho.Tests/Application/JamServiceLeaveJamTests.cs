using FakeItEasy;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using YtGuessWho.Application.Commands;
using YtGuessWho.Application.Exceptions;
using YtGuessWho.Application.Repositories;
using YtGuessWho.Application.Services.Implementations;
using YtGuessWho.Domain.Aggregates;
using YtGuessWho.Domain.Extensions;

namespace YtGuessWho.Tests.Application;

/// <summary>
/// Unit tests for <see cref="JamService.LeaveJam"/>.
/// </summary>
public sealed class JamServiceLeaveJamTests
{
    private readonly IJamRepository _repository;
    private readonly JamService _sut;

    public JamServiceLeaveJamTests()
    {
        _repository = A.Fake<IJamRepository>();
        var logger = A.Fake<ILogger<JamService>>();
        _sut = new JamService(_repository, logger);
    }

    [Fact]
    public async Task LeaveJam_WhenPlayerIsInJamAndOthersRemain_ReturnsResultWithCorrectJamCode()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("bob-conn", "Bob");
        A.CallTo(() => _repository.FindByPlayerId("bob-conn")).Returns(jam);
        var command = new LeaveJamCommand("bob-conn");

        // Act
        var result = await _sut.LeaveJam(command);

        // Assert
        result.JamCode.Should().Be(jam.JamCode.Value);
    }

    [Fact]
    public async Task LeaveJam_WhenNonHostPlayerLeaves_ReturnsJamIsEmptyFalse()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("bob-conn", "Bob");
        A.CallTo(() => _repository.FindByPlayerId("bob-conn")).Returns(jam);
        var command = new LeaveJamCommand("bob-conn");

        // Act
        var result = await _sut.LeaveJam(command);

        // Assert
        result.JamIsEmpty.Should().BeFalse();
    }

    [Fact]
    public async Task LeaveJam_WhenNonHostPlayerLeaves_ReturnsNullNewHostPlayerId()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("bob-conn", "Bob");
        A.CallTo(() => _repository.FindByPlayerId("bob-conn")).Returns(jam);
        var command = new LeaveJamCommand("bob-conn");

        // Act
        var result = await _sut.LeaveJam(command);

        // Assert
        result.NewHostPlayerId.Should().BeNull();
    }

    [Fact]
    public async Task LeaveJam_WhenHostPlayerLeavesAndOthersRemain_ReturnsNonNullNewHostPlayerId()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("bob-conn", "Bob");
        A.CallTo(() => _repository.FindByPlayerId("host-conn")).Returns(jam);
        var command = new LeaveJamCommand("host-conn");

        // Act
        var result = await _sut.LeaveJam(command);

        // Assert
        result.NewHostPlayerId.Should().NotBeNull();
    }

    [Fact]
    public async Task LeaveJam_WhenHostPlayerLeavesAndOthersRemain_NewHostPlayerIdIsARemainingPlayer()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("bob-conn", "Bob");
        A.CallTo(() => _repository.FindByPlayerId("host-conn")).Returns(jam);
        var command = new LeaveJamCommand("host-conn");

        // Act
        var result = await _sut.LeaveJam(command);

        // Assert
        result.NewHostPlayerId.Should().Be("bob-conn");
    }

    [Fact]
    public async Task LeaveJam_WhenLastPlayerLeaves_ReturnsJamIsEmptyTrue()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        A.CallTo(() => _repository.FindByPlayerId("host-conn")).Returns(jam);
        var command = new LeaveJamCommand("host-conn");

        // Act
        var result = await _sut.LeaveJam(command);

        // Assert
        result.JamIsEmpty.Should().BeTrue();
    }

    [Fact]
    public async Task LeaveJam_WhenLastPlayerLeaves_CallsRepositoryRemove()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        var expectedCode = jam.JamCode.Value;
        A.CallTo(() => _repository.FindByPlayerId("host-conn")).Returns(jam);
        var command = new LeaveJamCommand("host-conn");

        // Act
        await _sut.LeaveJam(command);

        // Assert
        A.CallTo(() => _repository.Remove(expectedCode)).MustHaveHappenedOnceExactly();
    }

    [Fact]
    public async Task LeaveJam_WhenLastPlayerLeaves_ReturnsNullNewHostPlayerId()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        A.CallTo(() => _repository.FindByPlayerId("host-conn")).Returns(jam);
        var command = new LeaveJamCommand("host-conn");

        // Act
        var result = await _sut.LeaveJam(command);

        // Assert
        result.NewHostPlayerId.Should().BeNull();
    }

    [Fact]
    public async Task LeaveJam_WhenOthersRemain_DoesNotCallRepositoryRemove()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("bob-conn", "Bob");
        A.CallTo(() => _repository.FindByPlayerId("bob-conn")).Returns(jam);
        var command = new LeaveJamCommand("bob-conn");

        // Act
        await _sut.LeaveJam(command);

        // Assert
        A.CallTo(() => _repository.Remove(A<string>._)).MustNotHaveHappened();
    }

    [Fact]
    public async Task LeaveJam_WhenPlayerIsNotInAnyJam_ThrowsNotInJamException()
    {
        // Arrange
        A.CallTo(() => _repository.FindByPlayerId("unknown-conn")).Returns(null);
        var command = new LeaveJamCommand("unknown-conn");

        // Act
        var act = () => _sut.LeaveJam(command);

        // Assert
        await act.Should().ThrowAsync<NotInJamException>();
    }

    [Fact]
    public async Task LeaveJam_WhenPlayerIsNotInAnyJam_DoesNotCallRepositoryRemove()
    {
        // Arrange
        A.CallTo(() => _repository.FindByPlayerId("unknown-conn")).Returns(null);
        var command = new LeaveJamCommand("unknown-conn");

        // Act
        try { await _sut.LeaveJam(command); } catch (NotInJamException) { }

        // Assert
        A.CallTo(() => _repository.Remove(A<string>._)).MustNotHaveHappened();
    }
}

