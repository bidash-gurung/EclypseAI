const { searchTrials } = require("../services/clinicalTrialsService");
const { getStartDateRange } = require("../services/clinicalTrialsMetaService");
const { validateTrialFilters } = require("../utils/validateTrialFilters");
// function getYear(value) {
//   if (value === undefined || value === "") return null;

//   if (typeof value !== "string" || !/^\d{4}$/.test(value)) {
//     return NaN;
//   }

//   const year = Number(value);

//   return year >= 1900 && year <= 2100 ? year : NaN;
// }

function getYear(value, minYear, maxYear) {
  if (value === undefined || value === "") return null;

  if (typeof value !== "string" || !/^\d{4}$/.test(value)) {
    return NaN;
  }

  const year = Number(value);

  return year >= minYear && year <= maxYear ? year : NaN;
}
// Find an enum group, such as Status or Phase, and return its accepted values.

async function getTrials(req, res) {
  try {
    const { minYear, maxYear } = await getStartDateRange();
    console.log(`StartDate range: ${minYear} - ${maxYear}`);
    const {
      condition = "",
      drug = "",
      status = "",
      phase = "",
      country = "",
      pageSize = "20",
      pageToken = "",
      startYear,
      startYearFrom,
      endYear,
    } = req.query;

    // Ensure text parameters are single strings.
    const stringFields = { condition, drug, status, phase, country, pageToken };

    for (const [field, value] of Object.entries(stringFields)) {
      if (typeof value !== "string") {
        return res.status(400).json({
          success: false,
          message: `Invalid "${field}" parameter. Provide a single string.`,
        });
      }
    }

    // // Require at least a condition or an intervention.
    // if (!condition.trim() && !drug.trim() && !country.trim()) {
    //   return res.status(400).json({
    //     success: false,
    //     message:
    //       "Provide at least a condition, a drug/intervention, or a country.",
    //   });
    // }

    // Limit excessively long search inputs.
    if (condition.length > 200 || drug.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Condition and drug searches must not exceed 200 characters.",
      });
    }

    // Validate status and phase using the shared validation utility.
    //validateTrialFilters will return true or false
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

    // Validate page size.
    if (
      typeof pageSize !== "string" || //check if pageSize is a string
      !/^\d+$/.test(pageSize) || //check if pageSize is a number
      Number(pageSize) < 1 || //check if pageSize is less than 1
      Number(pageSize) > 1000 //check if pageSize is greater than 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "pageSize must be an integer between 1 and 1000.",
      });
    }

    //   Country name validation
    if (country.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Country must not exceed 100 characters.",
      });
    }
    // Validate pagination token.
    if (pageToken.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "The pagination token is too long.",
      });
    }

    // Validate the requested year range.
    const start = getYear(startYear, minYear, maxYear);
    const startFrom = getYear(startYearFrom, minYear, maxYear);
    const end = getYear(endYear, minYear, maxYear);

    if (Number.isNaN(start) || Number.isNaN(startFrom) || Number.isNaN(end)) {
      return res.status(400).json({
        success: false,
        message: `Years must be four-digit values between ${minYear} and ${maxYear}.`,
      });
    }

    if (start !== null && end !== null && start > end) {
      return res.status(400).json({
        success: false,
        message: "startYear cannot be greater than endYear.",
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

    const filters = {
      condition: condition.trim(),
      drug: drug.trim(),
      status: status.trim(),
      phase: phase.trim(),
      country: country.trim(),
      pageSize,
      pageToken,
      startYear: startYear || "",
      startYearFrom: startYearFrom || "",
      endYear: endYear || "",
    };

    const data = await searchTrials(filters);

    return res.status(200).json({
      success: true,
      totalCount: data.totalCount,
      trials: data.studies,
      nextPageToken: data.nextPageToken || null,
    });
  } catch (error) {
    console.error("Error fetching clinical trials:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch clinical trials.",
    });
  }
}

module.exports = { getTrials };
