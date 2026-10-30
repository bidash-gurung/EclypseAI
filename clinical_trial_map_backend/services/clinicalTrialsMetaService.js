const { redisClient } = require("../configs/redis");
const crypto = require("crypto");

const API_BASE_URL = process.env.CLINICAL_TRIALS_API_URL;
const CACHE_TTL_SECONDS = 3600; // 1 hour
const REQUEST_TIMEOUT_MS = 10_000;

async function fetchClinicalTrialsEndpoint(path = "") {
  if (!API_BASE_URL) {
    throw new Error("CLINICAL_TRIALS_API_URL is not configured.");
  }

  // Convert the studies URL into the common API base URL.
  const apiBaseUrl = API_BASE_URL.replace(/\/studies\/?$/, "");
  const url = `${apiBaseUrl}/${path.replace(/^\/+/, "")}`;

  // Create a unique Redis cache key for this URL.
  const cacheKey = `clinical-trials-meta:${crypto
    .createHash("sha256")
    .update(url)
    .digest("hex")}`;

  // Try Redis before making an external request.
  try {
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      console.log(`Metadata cache hit: ${path}`);
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.warn("Redis cache read failed:", error.message);
  }

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    console.log(`Fetching ClinicalTrials.gov: ${url}`);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`ClinicalTrials.gov returned HTTP ${response.status}`);
    }

    const data = await response.json();

    // Cache the response for one hour.
    try {
      await redisClient.setEx(
        cacheKey,
        CACHE_TTL_SECONDS,
        JSON.stringify(data),
      );

      console.log(`Metadata cached: ${path}`);
    } catch (error) {
      console.warn("Redis cache write failed:", error.message);
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`ClinicalTrials.gov request timed out: ${path}`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Retrieves the available ClinicalTrials.gov enum values.
 * Uses the existing Redis cache through fetchClinicalTrialsEndpoint().
 */

async function getClinicalTrialEnums() {
  const response = await fetchClinicalTrialsEndpoint("studies/enums");

  // Support both the raw ClinicalTrials.gov response and
  // the wrapped response format used by your backend.
  const enumGroups = Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.enums)
        ? response.enums
        : null;

  if (!enumGroups) {
    throw new Error(
      "ClinicalTrials.gov returned an unexpected enums response.",
    );
  }

  return enumGroups;
}

module.exports = {
  fetchClinicalTrialsEndpoint,
  getClinicalTrialEnums,
};
