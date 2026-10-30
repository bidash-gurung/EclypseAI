const {
  getClinicalTrialEnums,
} = require("../services/clinicalTrialsMetaService");

function getAllowedEnumValues(enumGroups, enumType) {
  const enumGroup = enumGroups.find((item) => item.type === enumType);

  if (!enumGroup || !Array.isArray(enumGroup.values)) {
    throw new Error(`Enum values for "${enumType}" were not found.`);
  }

  return new Set(
    enumGroup.values
      .map((item) => (typeof item === "string" ? item : item?.value))
      .filter(Boolean),
  );
}

async function validateTrialFilters({ status = "", phase = "" }) {
  // Avoid fetching enums if neither filter was provided.
  if (!status && !phase) {
    return { valid: true };
  }

  const enumGroups = await getClinicalTrialEnums();

  if (status) {
    const allowedStatuses = getAllowedEnumValues(enumGroups, "Status");

    if (!allowedStatuses.has(status)) {
      return {
        valid: false,
        message: "Invalid recruitment status.",
        field: "status",
        allowedValues: [...allowedStatuses],
      };
    }
  }

  if (phase) {
    const allowedPhases = getAllowedEnumValues(enumGroups, "Phase");

    if (!allowedPhases.has(phase)) {
      return {
        valid: false,
        message: "Invalid study phase.",
        field: "phase",
        allowedValues: [...allowedPhases],
      };
    }
  }

  return { valid: true };
}

module.exports = { validateTrialFilters };
