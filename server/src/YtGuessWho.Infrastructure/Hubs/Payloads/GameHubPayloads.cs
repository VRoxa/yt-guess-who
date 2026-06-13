namespace YtGuessWho.Infrastructure.Hubs.Payloads;

/// <summary>
/// Payload sent to all Jam group members when a new Player successfully joins.
/// </summary>
public sealed record PlayerJoinedPayload(
    string PlayerId,
    string DisplayName,
    bool IsHost);

/// <summary>
/// Payload sent to remaining Jam group members when a Player disconnects.
/// </summary>
public sealed record PlayerLeftPayload(
    string PlayerId);

/// <summary>
/// Payload sent to all Jam group members when the Host advances the Jam to the next phase.
/// </summary>
public sealed record PhaseChangedPayload(
    string NewPhase);

/// <summary>
/// Payload sent to all Jam group members at the start of a Playback round.
/// The <see cref="YoutubeUrl"/> is intentionally anonymous — no owner identity is included.
/// </summary>
public sealed record RoundStartedPayload(
    int RoundIndex,
    string YoutubeUrl);

/// <summary>
/// Payload broadcast to the Jam group each time any Player submits a Guess.
/// Does not reveal the Guess content — only signals that a Player has submitted.
/// </summary>
public sealed record GuessSubmittedPayload(
    string PlayerId);

/// <summary>
/// Payload broadcast to the Jam group when all Players have submitted a Guess for the current Round.
/// Reveals the correct owner, all Guesses, and the Score delta for this Round.
/// </summary>
public sealed record RoundEndedPayload(
    int RoundIndex,
    string CorrectOwnerId,
    IReadOnlyDictionary<string, string> Guesses,
    IReadOnlyDictionary<string, int> ScoresDelta);

/// <summary>
/// Payload broadcast to the Jam group when all Rounds are complete.
/// Contains the final leaderboard ordered by Score.
/// </summary>
public sealed record GameEndedPayload(
    IReadOnlyList<PlayerFinalScore> FinalScores);

/// <summary>
/// A single entry in the <see cref="GameEndedPayload.FinalScores"/> leaderboard.
/// </summary>
public sealed record PlayerFinalScore(
    string PlayerId,
    string DisplayName,
    int Score);

/// <summary>
/// Payload sent exclusively to the caller when a hub method call fails validation
/// or violates a game rule. Never broadcast to the group.
/// </summary>
public sealed record ErrorPayload(
    string Code,
    string Message);

