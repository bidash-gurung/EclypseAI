const axios = require("axios");
const crypto = require("crypto");
const { redisClient } = require("../configs/redis");
const { searchTrials } = require("./clinicalTrialsService");
const { validateTrialFilters } = require("../utils/validateTrialFilters");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3.5:9b";
const AGGREGATION_PAGE_SIZE = 1000;
const ACTIVE_INDEX_KEY = "clinical-trials:index:active";
const AGGREGATION_CACHE_TTL = 1800;
const SUPPORTED_GROUP_FIELDS = [
  "startYear",
  "completionYear",
  "status",
  "phase",
  "sponsor",
  "country",
  "condition",
  "intervention",
  "studyType",
];
const FILTER_FIELDS = ["condition", "drug", "status", "phase", "country"];
const YEAR_FIELDS = ["startYear", "startYearFrom", "endYear"];
const TASKS = ["count", "list", "top", "distribution", "unsupported"];
const PRESENTATIONS = ["auto", "count", "table", "graphical", "both", "insights"];

const queryPlanSchema = {
  type: "object",
  properties: {
    task: { type: "string", enum: TASKS },
    groupBy: { type: "string", enum: ["none", ...SUPPORTED_GROUP_FIELDS] },
    rank: { type: "string", enum: ["most", "least"] },
    presentation: { type: "string", enum: PRESENTATIONS },
    contextMode: { type: "string", enum: ["refine", "reset"] },
    clearFilters: { type: "array", items: { type: "string", enum: [...FILTER_FIELDS, ...YEAR_FIELDS] } },
    filters: {
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
      required: ["condition", "drug", "status", "phase", "country", "startYear", "startYearFrom", "endYear"],
    },
    limit: { type: "integer" },
  },
  required: ["task", "groupBy", "rank", "presentation", "contextMode", "clearFilters", "filters", "limit"],
};

function safeContext(context) {
  const result = {};
  if (!context || typeof context !== "object" || Array.isArray(context)) return result;
  const limits = { condition: 200, drug: 200, status: 100, phase: 40, country: 100 };
  for (const [key, max] of Object.entries(limits)) {
    const value = context[key];
    if (typeof value === "string" && value.trim() && value.length <= max) {
      const normalized = value.trim();
      if (key === "condition" && /^(?:early\s+)?phase\s*(?:1|2|3|4|i|ii|iii|iv)|^(?:EARLY_)?PHASE[1-4]$/i.test(normalized)) continue;
      result[key] = normalized;
    }
  }
  for (const key of YEAR_FIELDS) {
    const value = context[key];
    if (Number.isInteger(value) && value >= 1900 && value <= 2100) result[key] = value;
  }
  return result;
}

function safeConversationContext(context) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return {};
  const result = {};
  if (["count", "list", "top", "distribution"].includes(context.task)) result.task = context.task;
  if (SUPPORTED_GROUP_FIELDS.includes(context.groupBy)) result.groupBy = context.groupBy;
  if (["most", "least"].includes(context.rank)) result.rank = context.rank;
  if (["count", "table", "graphical", "both", "insights"].includes(context.presentation)) result.presentation = context.presentation;
  if (typeof context.question === "string") result.question = context.question.slice(0, 2000);
  return result;
}

function applyFollowUpIntent(plan, question, conversationContext) {
  const previous = safeConversationContext(conversationContext);
  const elliptical = /^(?:and\s+)?(?:what|how)\s+about\b/i.test(question.trim());
  if (!elliptical || !previous.task) return plan;
  plan.task = previous.task;
  if (["top", "distribution"].includes(previous.task) && previous.groupBy) plan.groupBy = previous.groupBy;
  else if (previous.task === "count" || previous.task === "list") plan.groupBy = "none";
  if (previous.rank) plan.rank = previous.rank;
  if (previous.presentation) plan.presentation = previous.presentation;
  plan.contextMode = "refine";
  return plan;
}
function applyExplicitQuestionFilters(plan, question) {
  const normalizedQuestion = question.toLowerCase();
  const phasePatterns = [
    [/\bearly\s+phase\s*1\b/, "EARLY_PHASE1"],
    [/\bphase\s*(?:1|i)\b/, "PHASE1"],
    [/\bphase\s*(?:2|ii)\b/, "PHASE2"],
    [/\bphase\s*(?:3|iii)\b/, "PHASE3"],
    [/\bphase\s*(?:4|iv)\b/, "PHASE4"],
  ];
  const explicitPhase = phasePatterns.find(([pattern]) => pattern.test(normalizedQuestion));
  if (explicitPhase) {
    plan.filters.phase = explicitPhase[1];
    if (plan.filters.condition && /^(?:early\s+)?phase\s*(?:1|2|3|4|i|ii|iii|iv)|^(?:EARLY_)?PHASE[1-4]$/i.test(plan.filters.condition.trim())) {
      plan.filters.condition = "";
    }
  }

  const explicitStartYear = normalizedQuestion.match(/\b(?:start\s+year|study\s+start(?:ed)?|starting\s+in|start(?:ed)?\s+in|in\s+year)\s+(\d{4})\b/);
  if (explicitStartYear) {
    plan.filters.startYear = Number(explicitStartYear[1]);
    plan.filters.startYearFrom = null;
  }
  return plan;
}
async function planQuestion(question, contextFilters, conversationContext = {}) {
  const response = await axios.post(
    `${OLLAMA_URL}/api/chat`,
    {
      model: OLLAMA_MODEL,
      stream: false,
      think: false,
      format: queryPlanSchema,
      options: { temperature: 0 },
      messages: [
        {
          role: "system",
          content: `You create a safe structured query plan for a clinical-trial dataset. Return only the required JSON.

Supported study fields for grouping and ranking: study start year, completion year, recruitment status, study phase, lead sponsor, location country, condition, intervention/drug, and study type. If a question needs a field or operation outside this list, use task=unsupported.

Tasks:
- count: asks how many / total number of studies.
- list: asks to display matching study records.
- top: asks which value/year/sponsor/country/phase has the most or least studies. Set groupBy to the requested field.
- distribution: asks for breakdown, comparison, trends, or counts by a field. Set groupBy to that field.
- unsupported: the requested data cannot be answered from supported fields.

Presentation:
- count when only a number is requested.
- table when study records/a table are explicitly requested.
- graphical when a graph/chart is explicitly requested.
- both when both a table and a graph/insights are requested.
- insights when the user requests insights or a ranking/trend answer.
- auto otherwise.

Filter rules:
- Return the effective filters, including carried context only when this is clearly a follow-up/refinement. Set contextMode=refine for follow-ups such as “only in Canada”, “what about 2025?”, “those studies”, or “break them down by year”. Set contextMode=reset for an independent new question or a request about all studies.
- When refining, retain prior filters not changed by the latest message. Put explicitly removed filter names in clearFilters. When resetting, ignore active filters unless restated.
- A start year by itself is exact. “2025 or later” means startYearFrom=2025. “After 2013” means startYearFrom=2014. Do not treat startYear as a lower bound.
- “start year” refers to trial start date; “completion year” refers to completion date.
- Use phase values NA, EARLY_PHASE1, PHASE1, PHASE2, PHASE3, PHASE4. Use official recruitment statuses.
- NA and PHASE1/PHASE2/PHASE3/PHASE4 are phase values, never recruitment statuses. If no recruitment status is requested, set status to an empty string.
- Do not invent requested conditions, drugs, countries, or year constraints.
- groupBy must be one of the supported fields. Use none for count/list/unsupported tasks unless a field is specifically requested.
- limit must be from 1 to 20.
- For highest/most/largest set rank=most; for lowest/least/smallest set rank=least. Use rank=most when no direction is stated.
- If task=top, choose presentation=insights unless the user explicitly asks for table, graph, or both.
          `.trim(),
        },
        {
          role: "user",
          content: JSON.stringify({
            activeFilters: safeContext(contextFilters),
            previousQuery: safeConversationContext(conversationContext),
            latestUserMessage: question,
          }),
        },
      ],
    },
    { timeout: 120000 },
  );

  let plan;
  try {
    plan = JSON.parse(response.data.message.content);
  } catch {
    throw new Error("The AI returned an invalid query plan.");
  }
  applyFollowUpIntent(plan, question, conversationContext);
  applyExplicitQuestionFilters(plan, question);
  const active = safeContext(contextFilters);
  if (!Array.isArray(plan.clearFilters) || plan.clearFilters.some((field) => ![...FILTER_FIELDS, ...YEAR_FIELDS].includes(field))) {
    throw new Error("The AI returned invalid cleared-filter fields.");
  }
  if (plan.contextMode === "refine") {
    for (const field of [...FILTER_FIELDS, ...YEAR_FIELDS]) {
      if (plan.clearFilters.includes(field)) {
        plan.filters[field] = YEAR_FIELDS.includes(field) ? null : "";
      } else if ((plan.filters[field] === "" || plan.filters[field] === null) && active[field] !== undefined) {
        plan.filters[field] = active[field];
      }
    }
  }
  return validatePlan(plan);
}

function normalizeStatus(status) {
  const normalized = status.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized === "NOT_RECRUITING" ? "ACTIVE_NOT_RECRUITING" : normalized;
}
async function validatePlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new Error("The AI returned an invalid query plan.");
  }
  if (!TASKS.includes(plan.task) || !SUPPORTED_GROUP_FIELDS.includes(plan.groupBy) && plan.groupBy !== "none") {
    throw new Error("The AI selected an unsupported query operation or field.");
  }
  if (!PRESENTATIONS.includes(plan.presentation) || !["refine", "reset"].includes(plan.contextMode) || !["most", "least"].includes(plan.rank)) {
    throw new Error("The AI returned invalid query options.");
  }
  if (!Number.isInteger(plan.limit) || plan.limit < 1 || plan.limit > 20) {
    throw new Error("The AI returned an invalid result limit.");
  }

  const filters = plan.filters;
  const allowed = [...FILTER_FIELDS, ...YEAR_FIELDS];
  if (!filters || typeof filters !== "object" || Array.isArray(filters) || Object.keys(filters).some((key) => !allowed.includes(key))) {
    throw new Error("The AI returned invalid filters.");
  }
  for (const key of FILTER_FIELDS) {
    if (typeof filters[key] !== "string") throw new Error(`Invalid ${key} filter.`);
    filters[key] = key === "status" ? normalizeStatus(filters[key]) : filters[key].trim();
    if (key === "status" && ["NA", "EARLY_PHASE1", "PHASE1", "PHASE2", "PHASE3", "PHASE4"].includes(filters[key])) {
      filters[key] = "";
    }
  }
  for (const key of YEAR_FIELDS) {
    if (filters[key] !== null && (!Number.isInteger(filters[key]) || filters[key] < 1900 || filters[key] > 2100)) {
      throw new Error(`Invalid ${key} filter.`);
    }
  }
  if (filters.startYear !== null && filters.startYearFrom !== null) throw new Error("Use either an exact start year or a start-year lower bound.");
  if (filters.startYear !== null && filters.endYear !== null && filters.startYear > filters.endYear) throw new Error("The requested year range is invalid.");
  if (filters.startYearFrom !== null && filters.endYear !== null && filters.startYearFrom > filters.endYear) throw new Error("The requested year range is invalid.");

  if (filters.status) {
    const validation = await validateTrialFilters({ status: filters.status });
    if (!validation.valid) throw new Error(`Invalid recruitment status: ${filters.status}`);
  }
  if (filters.phase) {
    const validation = await validateTrialFilters({ phase: filters.phase });
    if (!validation.valid) throw new Error(`Invalid study phase: ${filters.phase}`);
  }
  if (["top", "distribution"].includes(plan.task) && !SUPPORTED_GROUP_FIELDS.includes(plan.groupBy)) {
    throw new Error("The requested analysis needs a supported grouping field.");
  }
  return plan;
}

function valuesFor(trial, field) {
  const unique = (values) => [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
  switch (field) {
    case "startYear": {
      const match = String(trial.startDate || "").match(/^(\d{4})/);
      return match ? [match[1]] : [];
    }
    case "completionYear": {
      const match = String(trial.completionDate || "").match(/^(\d{4})/);
      return match ? [match[1]] : [];
    }
    case "status": return unique([trial.status]);
    case "phase": return unique((trial.phases || []).flatMap((phase) => String(phase).split("/")));
    case "sponsor": return unique([trial.sponsor]);
    case "country": return unique((trial.locations || []).map((location) => location.country));
    case "condition": return unique(trial.conditions || []);
    case "intervention": return unique((trial.interventions || []).map((item) => item?.name));
    case "studyType": return unique([trial.studyType]);
    default: return [];
  }
}

const FIELD_LABELS = {
  startYear: "study start year",
  completionYear: "completion year",
  status: "recruitment status",
  phase: "study phase",
  sponsor: "sponsor",
  country: "country",
  condition: "condition",
  intervention: "intervention",
  studyType: "study type",
};

async function aggregateMatchingTrials(filters, groupBy, limit, rank = "most") {
  const cacheKeyMaterial = JSON.stringify({
    version: await redisClient.get(ACTIVE_INDEX_KEY),
    filters,
    groupBy,
    limit,
    rank,
  });
  const cacheKey = `clinical-trials:ai-aggregation:${crypto.createHash("sha256").update(cacheKeyMaterial).digest("hex")}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (error) {
    console.warn("AI aggregation cache read failed:", error.message);
  }

  const counts = new Map();
  let totalMatchingTrials = 0;
  let analyzedTrials = 0;
  let pageToken = "";
  let firstPage = true;

  do {
    const result = await searchTrials({ ...filters, pageSize: AGGREGATION_PAGE_SIZE, pageToken });
    if (firstPage) {
      totalMatchingTrials = result.totalCount;
      firstPage = false;
    }
    for (const trial of result.studies) {
      analyzedTrials += 1;
      for (const value of valuesFor(trial, groupBy)) counts.set(value, (counts.get(value) || 0) + 1);
    }
    pageToken = result.nextPageToken || "";
  } while (pageToken);

  const items = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (rank === "least" ? a.count - b.count : b.count - a.count) || String(a.name).localeCompare(String(b.name)));

  const analysis = {
    groupBy,
    fieldLabel: FIELD_LABELS[groupBy],
    items: items.slice(0, limit),
    totalGroups: items.length,
    totalMatchingTrials,
    analyzedTrials,
    complete: analyzedTrials === totalMatchingTrials,
  };

  try {
    await redisClient.setEx(cacheKey, AGGREGATION_CACHE_TTL, JSON.stringify(analysis));
  } catch (error) {
    console.warn("AI aggregation cache write failed:", error.message);
  }
  return analysis;
}

function resolvePresentation(plan) {
  if (plan.presentation !== "auto") return plan.presentation;
  if (plan.task === "count") return "count";
  if (plan.task === "list") return "table";
  if (plan.task === "top" || plan.task === "distribution") return "insights";
  return "count";
}

function countAnswer(total, filters) {
  const phaseLabels = { NA: "N/A", EARLY_PHASE1: "Early Phase 1", PHASE1: "Phase 1", PHASE2: "Phase 2", PHASE3: "Phase 3", PHASE4: "Phase 4" };
  const subject = `${filters.phase ? `${phaseLabels[filters.phase] || filters.phase} ` : ""}clinical trial${total === 1 ? "" : "s"}`;
  const qualifiers = [];
  if (filters.condition) qualifiers.push(`for ${filters.condition}`);
  if (filters.drug) qualifiers.push(`involving ${filters.drug}`);
  if (filters.status) qualifiers.push(`with status ${filters.status.toLowerCase().replaceAll("_", " ")}`);
  if (filters.country) qualifiers.push(`in ${filters.country}`);
  if (filters.startYear !== null) qualifiers.push(`with study start year ${filters.startYear}`);
  if (filters.startYearFrom !== null) qualifiers.push(`starting in ${filters.startYearFrom} or later`);
  if (filters.endYear !== null) qualifiers.push(`with completion year ${filters.endYear}`);
  return `There ${total === 1 ? "is" : "are"} ${Number(total).toLocaleString()} matching ${subject}${qualifiers.length ? ` ${qualifiers.join(", ")}` : " in total"}.`;
}

function analysisAnswer(plan, analysis) {
  const label = analysis.fieldLabel;
  if (!analysis.items.length) return `No matching trials have a reported ${label}.`;
  if (plan.task === "top") {
    const highest = analysis.items[0];
    const tied = analysis.items.filter((item) => item.count === highest.count).map((item) => item.name);
    const field = label === "study start year" ? "study starts" : `${label} values`;
    const topNames = tied.length > 1 ? tied.join(", ") : tied[0];
    const rankText = plan.rank === "least" ? "lowest" : "highest";
    return `The ${field} with the ${rankText} number of trials is ${topNames}, with ${Number(highest.count).toLocaleString()} trials.`;
  }
  const breakdown = analysis.items.slice(0, 5).map((item) => `${item.name}: ${Number(item.count).toLocaleString()}`).join("; ");
  const coverage = analysis.complete ? "all matching trials" : `${analysis.analyzedTrials.toLocaleString()} analyzed trials`;
  return `Breakdown by ${label} across ${coverage}: ${breakdown}.`;
}

async function answerTrialQuestion(question, pageSize = 20, pageToken = "", contextFilters = {}, conversationContext = {}) {
  if (typeof question !== "string" || !question.trim()) throw new Error("Please provide a question.");
  if (question.length > 2000) throw new Error("The question must not exceed 2000 characters.");
  const plan = await planQuestion(question.trim(), contextFilters, conversationContext);
  const filters = plan.filters;
  const presentation = resolvePresentation(plan);
  const results = plan.task === "unsupported"
    ? { totalCount: 0, nextPageToken: null, studies: [] }
    : await searchTrials({ ...filters, pageSize, pageToken });

  let analysis = null;
  let answer;
  if (plan.task === "unsupported") {
    answer = "I can answer questions about trial counts, study records, start/completion years, status, phase, sponsor, country, condition, intervention, and study type. This question needs a field outside that set.";
  } else if (plan.task === "top" || plan.task === "distribution") {
    analysis = await aggregateMatchingTrials(filters, plan.groupBy, plan.limit, plan.rank);
    answer = analysisAnswer(plan, analysis);
  } else if (plan.task === "count") {
    answer = countAnswer(results.totalCount, filters);
  } else {
    answer = `I found ${Number(results.totalCount).toLocaleString()} matching clinical trials. The matching studies are available in the table.`;
  }

  return {
    question: question.trim(),
    interpretedFilters: filters,
    queryPlan: {
      task: plan.task,
      groupBy: plan.groupBy === "none" ? null : plan.groupBy,
      fieldLabel: plan.groupBy === "none" ? null : FIELD_LABELS[plan.groupBy],
      contextMode: plan.contextMode,
      rank: plan.rank,
    },
    presentation,
    answer,
    totalCount: results.totalCount,
    trials: results.studies,
    nextPageToken: results.nextPageToken || null,
    analysis,
  };
}

module.exports = { answerTrialQuestion, planQuestion, aggregateMatchingTrials };
