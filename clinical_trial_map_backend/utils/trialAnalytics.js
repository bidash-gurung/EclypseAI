function buildTrialAnalytics(trials) {
  const statusCounts = {};
  const phaseCounts = {};
  const sponsorCounts = {};
  const countryCounts = {};
  const yearCounts = {};

  for (const trial of trials) {
    // Count trials by status.
    const status = trial.status || "Unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    // Count trials by individual phase.
    // Combined phases such as "Phase 2/Phase 3"
    // contribute once to Phase 2 and once to Phase 3.
    const phases =
      Array.isArray(trial.phases) && trial.phases.length > 0
        ? trial.phases
        : ["Unknown"];

    // Split combined phases and remove duplicates
    // so each trial counts at most once per phase.
    const individualPhases = new Set(
      phases.flatMap((phase) =>
        String(phase)
          .split("/")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );

    for (const phase of individualPhases) {
      phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
    }

    // Count trials by sponsor.
    const sponsor = trial.sponsor || "Unknown";
    sponsorCounts[sponsor] = (sponsorCounts[sponsor] || 0) + 1;

    // Count trials by country.
    // Each country is counted only once per trial.
    const countries = new Set(
      (trial.locations || [])
        .map((location) => location.country)
        .filter(Boolean),
    );

    for (const country of countries) {
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    }

    // Count trials by start year.
    const startDate = trial.startDate;
    const yearMatch =
      typeof startDate === "string" ? startDate.match(/\b\d{4}\b/) : null;

    if (yearMatch) {
      const year = yearMatch[0];
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    }
  }

  // Convert count objects to sorted arrays.
  const toSortedArray = (counts) =>
    Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

  return {
    statusCounts: toSortedArray(statusCounts),
    phaseCounts: toSortedArray(phaseCounts),
    topSponsors: toSortedArray(sponsorCounts).slice(0, 10),
    countryCounts: toSortedArray(countryCounts),
    trialsByYear: Object.entries(yearCounts)
      .map(([year, count]) => ({
        year: Number(year),
        count,
      }))
      .sort((a, b) => a.year - b.year),
  };
}

module.exports = { buildTrialAnalytics };
