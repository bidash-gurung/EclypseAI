const crypto = require("crypto");

const { searchTrials } = require("../services/clinicalTrialsService");
const { redisClient } = require("../configs/redis");
const { buildTrialAnalytics } = require("../utils/trialAnalytics");
const { validateTrialFilters } = require("../utils/validateTrialFilters");

const ANALYTICS_CACHE_TTL = 60 * 60; // 1 hour
const PAGE_SIZE = 1000;
const ACTIVE_INDEX_KEY = "clinical-trials:index:active";

function getYear(value) {
  if (value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string" || !/^\d{4}$/.test(value)) {
    return NaN;
  }

  const year = Number(value);

  return year >= 1900 && year <= 2100 ? year : NaN;
}

function getAnalyticsCacheKey(filters, indexVersion) {
  const normalizedFilters = {
    condition: filters.condition || "",
    drug: filters.drug || "",
    status: filters.status || "",
    phase: filters.phase || "",
    country: filters.country || "",
    startYear: filters.startYear || "",
    startYearFrom: filters.startYearFrom || "",
    endYear: filters.endYear || "",
  };

  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(normalizedFilters))
    .digest("hex");

  return `clinical-trials:analytics:v3:${indexVersion}:${hash}`;
}

async function getAnalytics(req, res) {
  try {
    const {
      condition = "",
      drug = "",
      status = "",
      phase = "",
      country = "",
      startYear,
      startYearFrom,
      endYear,
    } = req.query;

    // Validate string parameters.
    const stringFields = { condition, drug, status, phase, country };

    for (const [field, value] of Object.entries(stringFields)) {
      if (typeof value !== "string") {
        return res.status(400).json({
          success: false,
          message: `Invalid "${field}" parameter. Provide a single string.`,
        });
      }
    }

    if (condition.length > 200 || drug.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Condition and drug searches must not exceed 200 characters.",
      });
    }

    if (country.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Country must not exceed 100 characters.",
      });
    }

    const validation = await validateTrialFilters({
      status: status.trim(),
      phase: phase.trim(),
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
        [validation.field === "status" ? "allowedStatuses" : "allowedPhases"]:
          validation.allowedValues,
      });
    }

    // Validate year parameters.
    const start = getYear(startYear);
    const startFrom = getYear(startYearFrom);
    const end = getYear(endYear);

    if (Number.isNaN(start) || Number.isNaN(startFrom) || Number.isNaN(end)) {
      return res.status(400).json({
        success: false,
        message: "Years must be four-digit values between 1900 and 2100.",
      });
    }

    if (start !== null && startFrom !== null) {
      return res.status(400).json({
        success: false,
        message: "Use either startYear or startYearFrom, not both.",
      });
    }

    if (startFrom !== null && end !== null && startFrom > end) {
      return res.status(400).json({
        success: false,
        message: "startYearFrom cannot be greater than endYear.",
      });
    }

    if (start !== null && end !== null && end < start) {
      return res.status(400).json({
        success: false,
        message: "endYear must be greater than or equal to startYear.",
      });
    }

    const filters = {
      condition: condition.trim(),
      drug: drug.trim(),
      status: status.trim(),
      phase: phase.trim(),
      country: country.trim(),
      startYear: startYear || "",
      startYearFrom: startYearFrom || "",
      endYear: endYear || "",
      pageSize: PAGE_SIZE,
    };

    // Get the currently active Redis index version.
    const indexVersion = await redisClient.get(ACTIVE_INDEX_KEY);

    if (!indexVersion) {
      return res.status(503).json({
        success: false,
        message: "The clinical trial index is not available yet.",
      });
    }

    // Check the analytics cache before fetching trial pages.
    const cacheKey = getAnalyticsCacheKey(filters, indexVersion);
    const cachedResponse = await redisClient.get(cacheKey);

    if (cachedResponse) {
      console.log("Analytics cache hit:", cacheKey);

      return res.status(200).json(JSON.parse(cachedResponse));
    }

    console.log("Analytics cache miss. Calculating analytics...");

    const trials = [];
    const seenIds = new Set();

    let pageToken;
    let totalCount = 0;
    let pagesFetched = 0;

    // Fetch every page available for the selected filters.
    do {
      const result = await searchTrials({
        ...filters,
        pageToken,
      });

      if (pagesFetched === 0) {
        totalCount = result.totalCount;
      }

      for (const trial of result.studies) {
        const id = trial.nctId || trial.id;

        if (id && seenIds.has(id)) {
          continue;
        }

        if (id) {
          seenIds.add(id);
        }

        trials.push(trial);
      }

      pagesFetched += 1;
      pageToken = result.nextPageToken || undefined;

      console.log(`Analytics progress: ${trials.length}/${totalCount} trials`);
    } while (pageToken);

    // Build the analytics from the collected trials.
    const analytics = buildTrialAnalytics(trials);

    const response = {
      success: true,
      filters: {
        condition: filters.condition || null,
        drug: filters.drug || null,
        status: filters.status || null,
        phase: filters.phase || null,
        country: filters.country || null,
        startYear: filters.startYear || null,
        startYearFrom: filters.startYearFrom || null,
        endYear: filters.endYear || null,
      },
      summary: {
        totalMatchingTrials: totalCount,
        analyzedTrials: trials.length,
        pagesFetched,
        complete: trials.length === totalCount,
      },
      analytics,
    };

    // Save the complete response in Redis for one hour.
    await redisClient.set(cacheKey, JSON.stringify(response), {
      EX: ANALYTICS_CACHE_TTL,
    });

    console.log("Analytics cached for one hour.");

    return res.status(200).json(response);
  } catch (error) {
    console.error("Analytics error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate trial analytics.",
    });
  }
}

module.exports = { getAnalytics };
