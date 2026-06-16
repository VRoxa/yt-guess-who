namespace YtGuessWho.Application.DTOs;

/// <summary>
/// Carries the outcome of a successful <c>SubmitSong</c> operation back to the Hub layer.
/// </summary>
/// <param name="JamCode">The invite code of the Jam the song was submitted to.</param>
/// <param name="AllSubmissionsReceived">
/// <c>true</c> when this Submission was the last outstanding one — every Player in the Jam
/// has now submitted. <c>false</c> while at least one Player has not yet submitted.
/// </param>
public sealed record SubmitSongResult(string JamCode, bool AllSubmissionsReceived);

