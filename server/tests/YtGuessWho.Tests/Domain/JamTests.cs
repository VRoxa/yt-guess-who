using FluentAssertions;
using YtGuessWho.Domain.Aggregates;
using YtGuessWho.Domain.Enums;
using YtGuessWho.Domain.Exceptions;
using YtGuessWho.Domain.ValueObjects;

namespace YtGuessWho.Tests.Domain;

/// <summary>
/// Unit tests for <see cref="Jam.CreateNew"/> and <see cref="JamCode"/>.
/// </summary>
public sealed class JamTests
{
    // ── Jam.CreateNew ────────────────────────────────────────────────────────

    [Fact]
    public void CreateNew_WhenCalled_ReturnsJamWithLobbyPhase()
    {
        // Arrange & Act
        var jam = Jam.CreateNew("conn-1", "Alice");

        // Assert
        jam.Phase.Should().Be(JamPhase.Lobby);
    }

    [Fact]
    public void CreateNew_WhenCalled_ReturnsJamWithExactlyOnePlayer()
    {
        // Arrange & Act
        var jam = Jam.CreateNew("conn-1", "Alice");

        // Assert
        jam.Players.Should().HaveCount(1);
    }

    [Fact]
    public void CreateNew_WhenCalled_HostPlayerIdEqualsConnectionId()
    {
        // Arrange & Act
        var jam = Jam.CreateNew("conn-abc", "Alice");

        // Assert
        jam.Players[0].PlayerId.Should().Be("conn-abc");
    }

    [Fact]
    public void CreateNew_WhenCalled_HostDisplayNameMatchesArgument()
    {
        // Arrange & Act
        var jam = Jam.CreateNew("conn-1", "Alice");

        // Assert
        jam.Players[0].DisplayName.Should().Be("Alice");
    }

    [Fact]
    public void CreateNew_WhenCalled_HostIsHostIsTrue()
    {
        // Arrange & Act
        var jam = Jam.CreateNew("conn-1", "Alice");

        // Assert
        jam.Players[0].IsHost.Should().BeTrue();
    }

    [Fact]
    public void CreateNew_WhenCalled_HostScoreIsZero()
    {
        // Arrange & Act
        var jam = Jam.CreateNew("conn-1", "Alice");

        // Assert
        jam.Players[0].Score.Should().Be(0);
    }

    [Fact]
    public void CreateNew_WhenCalled_HostSubmissionIsNull()
    {
        // Arrange & Act
        var jam = Jam.CreateNew("conn-1", "Alice");

        // Assert
        jam.Players[0].Submission.Should().BeNull();
    }

    [Fact]
    public void CreateNew_WhenCalled_JamCodeIsNotNull()
    {
        // Arrange & Act
        var jam = Jam.CreateNew("conn-1", "Alice");

        // Assert
        jam.JamCode.Should().NotBeNull();
    }

    [Fact]
    public void CreateNew_WhenCalledTwice_ProducesJamsWithDifferentCodes()
    {
        // Arrange & Act
        var jam1 = Jam.CreateNew("conn-1", "Alice");
        var jam2 = Jam.CreateNew("conn-2", "Bob");

        // Assert — statistically guaranteed (1 in ~309M chance of collision)
        jam1.JamCode.Value.Should().NotBe(jam2.JamCode.Value);
    }

    [Fact]
    public void CreateNew_WithNullConnectionId_ThrowsArgumentNullException()
    {
        // Arrange & Act
        var act = () => Jam.CreateNew(null!, "Alice");

        // Assert
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("connectionId");
    }

    [Fact]
    public void CreateNew_WithNullDisplayName_ThrowsArgumentNullException()
    {
        // Arrange & Act
        var act = () => Jam.CreateNew("conn-1", null!);

        // Assert
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("displayName");
    }

    // ── JamCode ──────────────────────────────────────────────────────────────

    [Fact]
    public void JamCode_Generate_ProducesCodeWithExactlysixCharacters()
    {
        // Arrange & Act
        var code = JamCode.Generate();

        // Assert
        code.Value.Should().HaveLength(6);
    }

    [Fact]
    public void JamCode_Generate_ProducesCodeContainingOnlyAllowedCharacters()
    {
        // Arrange
        const string allowedChars = "ABCDEFGHJKLMNPQRSTUVWXYZ";

        // Act
        var code = JamCode.Generate();

        // Assert
        foreach (var c in code.Value)
        {
            allowedChars.Should().Contain(c.ToString(),
                because: $"character '{c}' is not in the allowed set");
        }
    }

    [Fact]
    public void JamCode_Generate_NeverProducesAmbiguousCharacters()
    {
        // Arrange — run many iterations to reduce flakiness
        for (var i = 0; i < 200; i++)
        {
            // Act
            var code = JamCode.Generate();

            // Assert
            code.Value.Should().NotContain("I", because: "'I' is visually ambiguous");
            code.Value.Should().NotContain("O", because: "'O' is visually ambiguous");
        }
    }

    [Theory]
    [InlineData("")]
    [InlineData("ABC")]
    [InlineData("ABCDEFG")]
    [InlineData("ABCDE1")]
    [InlineData("abcdef")]
    [InlineData("ABCDEI")]
    [InlineData("ABCDEO")]
    public void JamCode_Constructor_WithInvalidValue_ThrowsArgumentException(string invalid)
    {
        // Arrange & Act
        var act = () => new JamCode(invalid);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("value");
    }

    [Fact]
    public void JamCode_Constructor_WithValidValue_SetsValueProperty()
    {
        // Arrange & Act
        var code = new JamCode("ABCDEF");

        // Assert
        code.Value.Should().Be("ABCDEF");
    }

    [Fact]
    public void JamCode_Constructor_WithNullValue_ThrowsArgumentNullException()
    {
        // Arrange & Act
        var act = () => new JamCode(null!);

        // Assert
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("value");
    }

    // ── Jam.AddPlayer ────────────────────────────────────────────────────────

    [Fact]
    public void AddPlayer_WhenJamIsInLobby_AddsPlayerToList()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");

        // Act
        jam.AddPlayer("joiner-conn", "Bob");

        // Assert
        jam.Players.Should().HaveCount(2);
    }

    [Fact]
    public void AddPlayer_WhenJamIsInLobby_NewPlayerIdEqualsConnectionId()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");

        // Act
        jam.AddPlayer("joiner-conn", "Bob");

        // Assert
        jam.Players[1].PlayerId.Should().Be("joiner-conn");
    }

    [Fact]
    public void AddPlayer_WhenJamIsInLobby_NewPlayerDisplayNameMatches()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");

        // Act
        jam.AddPlayer("joiner-conn", "Bob");

        // Assert
        jam.Players[1].DisplayName.Should().Be("Bob");
    }

    [Fact]
    public void AddPlayer_WhenJamIsInLobby_NewPlayerIsHostIsFalse()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");

        // Act
        jam.AddPlayer("joiner-conn", "Bob");

        // Assert
        jam.Players[1].IsHost.Should().BeFalse();
    }

    [Fact]
    public void AddPlayer_WhenJamIsInLobby_NewPlayerScoreIsZero()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");

        // Act
        jam.AddPlayer("joiner-conn", "Bob");

        // Assert
        jam.Players[1].Score.Should().Be(0);
    }

    [Fact]
    public void AddPlayer_WhenPhaseIsNotLobby_ThrowsJamNotJoinableException()
    {
        // Arrange — force the Jam into a non-Lobby phase via the internal setter
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.SetPhaseForTesting(JamPhase.Submission);

        // Act
        var act = () => jam.AddPlayer("joiner-conn", "Bob");

        // Assert
        act.Should().Throw<JamNotJoinableException>();
    }

    [Fact]
    public void AddPlayer_WithNullConnectionId_ThrowsArgumentNullException()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");

        // Act
        var act = () => jam.AddPlayer(null!, "Bob");

        // Assert
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("connectionId");
    }

    [Fact]
    public void AddPlayer_WithNullDisplayName_ThrowsArgumentNullException()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");

        // Act
        var act = () => jam.AddPlayer("joiner-conn", null!);

        // Assert
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("displayName");
    }

    // ── Jam.RemovePlayer ─────────────────────────────────────────────────────

    [Fact]
    public void RemovePlayer_WhenNonHostPlayerIsRemoved_DecrementsPlayerCount()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("bob-conn", "Bob");

        // Act
        jam.RemovePlayer("bob-conn");

        // Assert
        jam.Players.Should().HaveCount(1);
    }

    [Fact]
    public void RemovePlayer_WhenNonHostPlayerIsRemoved_RemainingPlayerRetainsHostStatus()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("bob-conn", "Bob");

        // Act
        jam.RemovePlayer("bob-conn");

        // Assert
        jam.Players[0].IsHost.Should().BeTrue();
    }

    [Fact]
    public void RemovePlayer_WhenNonHostPlayerIsRemoved_RemovedPlayerIsAbsent()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("bob-conn", "Bob");

        // Act
        jam.RemovePlayer("bob-conn");

        // Assert
        jam.Players.Should().NotContain(p => p.PlayerId == "bob-conn");
    }

    [Fact]
    public void RemovePlayer_WhenHostPlayerIsRemovedAndOthersRemain_ExactlyOneRemainingPlayerIsHost()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("bob-conn", "Bob");
        jam.AddPlayer("carol-conn", "Carol");

        // Act
        jam.RemovePlayer("host-conn");

        // Assert
        jam.Players.Count(p => p.IsHost).Should().Be(1);
    }

    [Fact]
    public void RemovePlayer_WhenHostPlayerIsRemovedAndOthersRemain_HostIsNoLongerInList()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("bob-conn", "Bob");

        // Act
        jam.RemovePlayer("host-conn");

        // Assert
        jam.Players.Should().NotContain(p => p.PlayerId == "host-conn");
    }

    [Fact]
    public void RemovePlayer_WhenLastPlayerIsRemoved_PlayersListIsEmpty()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");

        // Act
        jam.RemovePlayer("host-conn");

        // Assert
        jam.Players.Should().BeEmpty();
    }

    [Fact]
    public void RemovePlayer_WhenConnectionIdDoesNotMatch_PlayersListIsUnchanged()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");
        jam.AddPlayer("bob-conn", "Bob");

        // Act
        jam.RemovePlayer("unknown-conn");

        // Assert
        jam.Players.Should().HaveCount(2);
    }

    [Fact]
    public void RemovePlayer_WithNullConnectionId_ThrowsArgumentNullException()
    {
        // Arrange
        var jam = Jam.CreateNew("host-conn", "Alice");

        // Act
        var act = () => jam.RemovePlayer(null!);

        // Assert
        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("connectionId");
    }
}

