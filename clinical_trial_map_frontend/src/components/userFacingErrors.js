export function userFacingError(message, fallback) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return fallback;

  const yearRange = text.match(
    /years must be four-digit values between (\d{4}) and (\d{4})/i,
  );
  if (yearRange)
    return `Enter a four-digit year between ${yearRange[1]} and ${yearRange[2]}.`;
  if (
    /startYear cannot be greater than endYear|endYear must be greater than or equal to startYear|startYearFrom cannot be greater than endYear/i.test(
      text,
    )
  ) {
    return "The end year must be the same as or later than the start year.";
  }
  if (/use either startYear or startYearFrom/i.test(text)) {
    return "Enter one start year only.";
  }
  if (/invalid recruitment status/i.test(text))
    return "Choose a valid recruitment status.";
  if (/invalid study phase/i.test(text)) return "Choose a valid study phase.";
  if (/condition and drug searches must not exceed 200 characters/i.test(text))
    return "Keep condition and treatment searches under 200 characters.";
  if (/country must not exceed 100 characters/i.test(text))
    return "Enter a country name under 100 characters.";
  if (/please provide a search question/i.test(text))
    return "Type a question or choose one of the suggestions.";
  if (/clinical trial index is not available yet/i.test(text)) {
    return "Trial data is still getting ready. Please try again shortly.";
  }

  const knownFriendlyMessages = [
    "The end year must be the same as or later than the start year.",
    "Enter one start year only.",
    "Choose a valid recruitment status.",
    "Choose a valid study phase.",
    "Keep condition and treatment searches under 200 characters.",
    "Enter a country name under 100 characters.",
    "Type a question or choose one of the suggestions.",
    "Trial data is still getting ready. Please try again shortly.",
  ];
  if (knownFriendlyMessages.includes(text)) return text;
  if (/^enter a four-digit year between \d{4} and \d{4}\.$/i.test(text))
    return text;
  if (/^enter a year between \d{4} and \d{4}\.$/i.test(text)) return text;
  if (/^enter the (start|end) year as a four-digit year\.$/i.test(text))
    return text;
  if (/^enter a start year when you specify an end year\.$/i.test(text))
    return text;

  // Never show raw transport, parser, database, or server details to users.
  return fallback;
}
