namespace YtGuessWho.Application.Commands;

/// <summary>
/// Command issued when a Player submits their YouTube URL during the Submission phase.
/// </summary>
/// <param name="ConnectionId">The SignalR ConnectionId of the submitting Player.</param>
/// <param name="YoutubeUrl">
/// The raw YouTube URL string. The <c>YoutubeUrl</c> value object is constructed
/// in the Domain layer, which is responsible for format validation.
/// </param>
public sealed record SubmitSongCommand(string ConnectionId, string YoutubeUrl);

