const { redisClient } = require("../configs/redis");

const API_BASE_URL = process.env.CLINICAL_TRIALS_API_URL;
const COUNTRIES_CACHE_KEY = "clinical-trials:countries";
const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const REQUEST_TIMEOUT_MS = 10000;

async function getCountries() {
  // Return cached countries when available.
  try {
    const cachedCountries = await redisClient.get(COUNTRIES_CACHE_KEY);

    if (cachedCountries) {
      console.log("Country list: Redis cache hit");
      return JSON.parse(cachedCountries);
    }
  } catch (error) {
    console.warn("Country cache read failed:", error.message);
  }

  if (!API_BASE_URL) {
    throw new Error("CLINICAL_TRIALS_API_URL is not configured.");
  }

  const statsUrl = `${new URL(API_BASE_URL).origin}/api/v2/stats/field/values?fields=LocationCountry`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(statsUrl, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`ClinicalTrials.gov returned HTTP ${response.status}`);
    }

    const result = await response.json();

    const countryStats = Array.isArray(result)
      ? result.find((item) => item.piece === "LocationCountry")
      : result?.piece === "LocationCountry"
        ? result
        : null;

    if (!countryStats || !Array.isArray(countryStats.topValues)) {
      throw new Error("Country values were missing from the API response");
    }

    const countries = [
      ...new Set(
        countryStats.topValues
          .map((item) => item.value?.trim())
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));

    if (
      typeof countryStats.uniqueValuesCount === "number" &&
      countries.length !== countryStats.uniqueValuesCount
    ) {
      console.warn(
        `Country list may be incomplete: received ${countries.length} of ${countryStats.uniqueValuesCount} unique values`,
      );
    }

    // Cache countries for 24 hours.
    try {
      await redisClient.setEx(
        COUNTRIES_CACHE_KEY,
        CACHE_TTL_SECONDS,
        JSON.stringify(countries),
      );

      console.log("Country list cached for 24 hours.");
    } catch (error) {
      console.warn("Country cache write failed:", error.message);
    }

    return countries;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Country list request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = { getCountries };
