namespace YtGuessWho.Domain.ValueObjects;

/// <summary>
/// Immutable value object representing a Jam's short invite code.
/// </summary>
/// <remarks>
/// The code is always exactly 6 uppercase alphabetic characters, excluding visually
/// ambiguous characters (<c>I</c> and <c>O</c>) to prevent confusion when sharing
/// codes verbally or in writing.
/// </remarks>
public sealed record JamCode
{
    private const string AllowedChars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const int CodeLength = 6;

    /// <summary>The raw 6-character uppercase code string.</summary>
    public string Value { get; }

    /// <summary>
    /// Initialises a <see cref="JamCode"/> from an existing string value.
    /// </summary>
    /// <param name="value">
    /// A 6-character uppercase string containing only characters from the allowed set
    /// (<c>A–Z</c> excluding <c>I</c> and <c>O</c>).
    /// </param>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="value"/> is <c>null</c>.</exception>
    /// <exception cref="ArgumentException">
    /// Thrown when <paramref name="value"/> does not conform to the expected format.
    /// </exception>
    public JamCode(string value)
    {
        ArgumentNullException.ThrowIfNull(value);

        if (!IsValidFormat(value))
        {
            throw new ArgumentException(
                $"'{value}' is not a valid JamCode. Expected exactly {CodeLength} uppercase characters " +
                $"from the allowed set (A–Z, excluding I and O).",
                nameof(value));
        }

        Value = value;
    }

    /// <summary>
    /// Generates a new random <see cref="JamCode"/> using the shared <see cref="Random"/> instance.
    /// </summary>
    /// <returns>A new <see cref="JamCode"/> with a randomly generated value.</returns>
    public static JamCode Generate()
    {
        var buffer = new char[CodeLength];

        for (var i = 0; i < CodeLength; i++)
        {
            buffer[i] = AllowedChars[Random.Shared.Next(AllowedChars.Length)];
        }

        return new JamCode(new string(buffer));
    }

    /// <inheritdoc />
    public override string ToString() => Value;

    private static bool IsValidFormat(string value)
    {
        if (value.Length != CodeLength)
        {
            return false;
        }

        foreach (var c in value)
        {
            if (!AllowedChars.Contains(c))
            {
                return false;
            }
        }

        return true;
    }
}

