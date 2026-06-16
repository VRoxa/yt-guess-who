using YtGuessWho.Infrastructure.Hubs.Payloads;

namespace YtGuessWho.Infrastructure.Hubs;

/// <summary>
/// Strongly-typed server → client event contract for the SignalR game hub.
/// Every event the server is permitted to push to connected clients must be
/// declared here first. <c>GameHub</c> is typed as <c>Hub&lt;IGameHubClient&gt;</c>,
/// so the compiler rejects any attempt to push an undeclared event.
/// </summary>
/// <remarks>
/// Full event payloads and their fields are specified in
/// <c>docs/realtime-communication.md — Server → Client Event Reference</c>.
/// </remarks>
public interface IGameHubClient
{
    /// <summary>
    /// Broadcast to all Jam group members when a new Player successfully joins.
    /// </summary>
    Task PlayerJoined(PlayerJoinedPayload payload);

    /// <summary>
    /// Broadcast to remaining Jam group members when a Player disconnects.
    /// </summary>
    Task PlayerLeft(PlayerLeftPayload payload);

    /// <summary>
    /// Broadcast to remaining Jam group members when a new Host is assigned
    /// because the previous Host left the Jam.
    /// </summary>
    Task HostChanged(HostChangedPayload payload);

    /// <summary>
    /// Broadcast to all Jam group members when the Host advances the Jam phase.
    /// </summary>
    Task PhaseChanged(PhaseChangedPayload payload);

    /// <summary>
    /// Broadcast to all Jam group members when a Player successfully submits their song URL.
    /// Does not reveal the URL — only signals which Player has submitted, so clients
    /// can update a submission progress indicator.
    /// </summary>
    Task SongSubmitted(SongSubmittedPayload payload);

    /// <summary>
    /// Broadcast to all Jam group members when every Player has submitted a Submission.
    /// Carries no payload — the event itself is the signal.
    /// </summary>
    Task AllSubmissionsReceived();

    /// <summary>
    /// Broadcast to all Jam group members at the start of a Playback Round.
    /// The YouTube URL is anonymous — no owner identity is included.
    /// </summary>
    Task RoundStarted(RoundStartedPayload payload);

    /// <summary>
    /// Broadcast to all Jam group members each time any Player submits a Guess.
    /// Does not reveal Guess content.
    /// </summary>
    Task GuessSubmitted(GuessSubmittedPayload payload);

    /// <summary>
    /// Broadcast to all Jam group members when all Players have submitted a Guess
    /// for the current Round. Reveals truth and Score changes.
    /// </summary>
    Task RoundEnded(RoundEndedPayload payload);

    /// <summary>
    /// Broadcast to all Jam group members when all Rounds are complete.
    /// Carries the final leaderboard.
    /// </summary>
    Task GameEnded(GameEndedPayload payload);

    /// <summary>
    /// Sent exclusively to the caller when a hub method call fails validation or
    /// violates a game rule. Never broadcast to the group.
    /// </summary>
    Task Error(ErrorPayload payload);
}

