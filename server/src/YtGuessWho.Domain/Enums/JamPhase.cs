namespace YtGuessWho.Domain.Enums;

/// <summary>
/// The ordered phases a <see cref="YtGuessWho.Domain.Aggregates.Jam"/> progresses through
/// from creation to completion.
/// </summary>
public enum JamPhase
{
    /// <summary>Players are joining the Jam. The Host has not yet started the game.</summary>
    Lobby,

    /// <summary>Each Player submits a YouTube URL of a song they want the group to guess.</summary>
    Submission,

    /// <summary>Songs are played one at a time in anonymous mode; Players submit Guesses.</summary>
    Playback,

    /// <summary>Scores are revealed and the game is complete.</summary>
    Results,
}

