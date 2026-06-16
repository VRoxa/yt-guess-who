namespace YtGuessWho.Application.DTOs;

/// <summary>
/// Carries the outcome of a successful <c>AdvancePhase</c> operation back to the Hub layer.
/// </summary>
/// <param name="JamCode">The invite code of the Jam whose phase was advanced.</param>
/// <param name="NewPhase">The phase the Jam has just transitioned into.</param>
public sealed record AdvancePhaseResult(string JamCode, string NewPhase);

