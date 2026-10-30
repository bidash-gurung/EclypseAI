const axios = require("axios");
const { searchTrials } = require("./clinicalTrialsService");
const { validateTrialFilters } = require("../utils/validateTrialFilters");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3.5:9b";

const filterSchema = {
  type: "object",
  properties: {
    condition: { type: "string" },
    drug: { type: "string" },
    status: { type: "string" },
    phase: { type: "string" },
    country: { type: "string" },
    startYear: { type: ["integer", "null"] },
    startYearFrom: { type: ["integer", "null"] },
    endYear: { type: ["integer", "null"] },
  },
  required: [
    "condition",
    "drug",
    "status",
    "phase",
    "country",
    "startYear",
    "startYearFrom",
    "endYear",
  ],
};

function sanitizeContextFilters(contextFilters) {
  if (!contextFilters || typeof contextFilters !== "object" || Array.isArray(contextFilters)) {
    return {};
  }

  const safeFilters = {};
  const stringLimits = { condition: 200, drug: 200, status: 100, phase: 40, country: 100 };
  for (const [field, maxLength] of Object.entries(stringLimits)) {
    const value = contextFilters[field];
    if (typeof value === "string" && value.trim() && value.length <= maxLength) {
      safeFilters[field] = value.trim();
    }
  }

  for (const field of ["startYear", "startYearFrom", "endYear"]) {
    const value = contextFilters[field];
    if (Number.isInteger(value) && value >= 1900 && value <= 2100) {
      safeFilters[field] = value;
    }
  }

  return safeFilters;
}
async function extractTrialFilters(question, contextFilters = {}) {
  const safeContextFilters = sanitizeContextFilters(contextFilters);
  const response = await axios.post(
    `${OLLAMA_URL}/api/chat`,
    {
      model: OLLAMA_MODEL,
      stream: false,
      think: false,
      format: filterSchema,
      options: { temperature: 0 },
      messages: [
        {
          role: "system",
          content: `
You extract filters for a clinical trial search engine.

Return only the JSON matching the supplied schema.

Rules:
- condition: medical condition or disease, otherwise empty string.
- drug: drug or intervention, otherwise empty string.
- status: use official ClinicalTrials.gov overall status values.
- phase: use NA, EARLY_PHASE1, PHASE1, PHASE2, PHASE3, or PHASE4.
- country: country name, otherwise empty string.
- startYear: exact study start year, otherwise null.
- startYearFrom: earliest requested study start year for "or later" or "at least", otherwise null.
- endYear: latest requested completion year, otherwise null.
- "recruiting" means RECRUITING.
- "Phase 3" means PHASE3.
- "2025 or later" means startYear null, startYearFrom 2025, and endYear null.
- "starting in 2025" means startYear 2025 and startYearFrom null.
- Carry forward active context filters unless the user explicitly changes or removes them.
- For questions about the current results (such as asking for trends, counts, or top countries), preserve the active context filters.
- Do not add filters that are neither in the new question nor the active context.
          `.trim(),
        },
        {
          role: "user",
          content: JSON.stringify({
            activeFilters: safeContextFilters,
            latestUserMessage: question,
          }),
        },
      ],
    },
    { timeout: 120000 },
  );

  let filters;

  try {
    filters = JSON.parse(response.data.message.content);
  } catch {
    throw new Error("The AI returned invalid filter JSON.");
  }

  // Only accept the fields supported by our search service.
  const allowedFields = [
    "condition",
    "drug",
    "status",
    "phase",
    "country",
    "startYear",
    "startYearFrom",
    "endYear",
  ];

  if (
    !filters ||
    typeof filters !== "object" ||
    Array.isArray(filters) ||
    Object.keys(filters).some((key) => !allowedFields.includes(key)) ||
    allowedFields.some((key) => !(key in filters))
  ) {
    throw new Error("The AI returned an invalid filter structure.");
  }

  for (const key of ["condition", "drug", "status", "phase", "country"]) {
    if (typeof filters[key] !== "string") {
      throw new Error(`Invalid AI filter: ${key}`);
    }

    filters[key] = filters[key].trim();
  }

  for (const key of ["startYear", "startYearFrom", "endYear"]) {
    if (
      filters[key] !== null &&
      (!Number.isInteger(filters[key]) ||
        filters[key] < 1900 ||
        filters[key] > 2100)
    ) {
      throw new Error(`Invalid AI filter: ${key}`);
    }
  }

  if (filters.startYear !== null && filters.startYearFrom !== null) {
    throw new Error("Use either an exact start year or a start year lower bound.");
  }

  if (
    filters.startYear !== null &&
    filters.endYear !== null &&
    filters.startYear > filters.endYear
  ) {
    throw new Error("The requested year range is invalid.");
  }

  if (
    filters.startYearFrom !== null &&
    filters.endYear !== null &&
    filters.startYearFrom > filters.endYear
  ) {
    throw new Error("The requested year range is invalid.");
  }

  if (filters.status) {
    const validation = await validateTrialFilters({
      status: filters.status,
    });

    if (!validation.valid) {
      throw new Error(
        `Invalid recruitment status returned by AI: ${filters.status}`,
      );
    }
  }

  if (filters.phase) {
    const validation = await validateTrialFilters({
      phase: filters.phase,
    });

    if (!validation.valid) {
      throw new Error(`Invalid study phase returned by AI: ${filters.phase}`);
    }
  }

  return filters;
}

async function searchTrialsWithAI(question, pageSize = 20, pageToken = "", contextFilters = {}) {
  if (typeof question !== "string" || !question.trim()) {
    throw new Error("Please provide a search question.");
  }

  if (question.length > 2000) {
    throw new Error("The search question must not exceed 2000 characters.");
  }

  const filters = await extractTrialFilters(question, contextFilters);

  const results = await searchTrials({
    ...filters,
    pageSize,
    pageToken,
  });

  return {
    question,
    interpretedFilters: filters,
    explanation:
      "Search filters were extracted from your question and applied to the clinical trial index.",
    totalCount: results.totalCount,
    trials: results.studies,
    nextPageToken: results.nextPageToken || null,
  };
}

module.exports = {
  extractTrialFilters,
  searchTrialsWithAI,
};
