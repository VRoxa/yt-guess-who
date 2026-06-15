namespace YtGuessWho.Application.DTOs;

/// <summary>
/// Carries the outcome of a successful <c>LeaveJam</c> operation back to the Hub layer.
/// </summary>
/// <param name="JamCode">The invite code of the Jam the Player just left.</param>
/// <param name="JamIsEmpty">
/// <c>true</c> when the Jam contained only the departing Player and has been removed
/// from the repository. <c>false</c> when at least one Player remains.
/// </param>
/// <param name="NewHostPlayerId">
/// The <c>PlayerId</c> of the Player promoted to Host when the departing Player was the
/// previous Host and at least one Player remains. <c>null</c> in all other cases.
/// </param>
public sealed record LeaveJamResult(string JamCode, bool JamIsEmpty, string? NewHostPlayerId);

