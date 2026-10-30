const { normalizeTrial } = require("../utils/normalizeTrial");
const { redisClient } = require("../configs/redis");
const crypto = require("crypto");

const API_BASE_URL = process.env.CLINICAL_TRIALS_API_URL;
const CACHE_TTL_SECONDS = 300;
const REQUEST_TIMEOUT_MS = 10_000;

const PREFIX = "clinical-trials:";
const ACTIVE_INDEX_KEY = `${PREFIX}index:active`;
const SEARCH_PREFIX = `${PREFIX}search:results:`;
const YEAR_PREFIX = `${PREFIX}search:years:`;

const MAX_PAGE_SIZE = 1000;

const ALLOWED_PHASES = [
  "NA",
  "EARLY_PHASE1",
  "PHASE1",
  "PHASE2",
  "PHASE3",
  "PHASE4",
];

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function indexKey(version, type, value) {
  return `${PREFIX}index:${version}:${type}:${encodeURIComponent(
    normalize(value),
  )}`;
}

function getPageSize(value) {
  const size = Number(value) || 20;
  return Math.min(Math.max(Math.floor(size), 1), MAX_PAGE_SIZE);
}
function matchesYearFilter(trial, filters) {
  const yearRange = getYearRange(filters);
  if (!yearRange) return true;

  const startDate =
    trial.protocolSection?.statusModule?.startDateStruct?.date ?? trial.startDate;
  const completionDate =
    trial.protocolSection?.statusModule?.completionDateStruct?.date ?? trial.completionDate;
  const getYear = (value) => {
    if (!value) return null;
    const match = String(value).match(/^(\d{4})/);
    return match ? Number(match[1]) : null;
  };
  const actualStartYear = getYear(startDate);
  const actualCompletionYear = getYear(completionDate);

  if (yearRange.start !== null && actualStartYear !== yearRange.start) return false;
  if (
    yearRange.startFrom !== null &&
    (actualStartYear === null || actualStartYear < yearRange.startFrom)
  ) return false;
  if (yearRange.end !== null) {
    if (yearRange.start !== null) {
      if (actualCompletionYear !== yearRange.end) return false;
    } else if (actualCompletionYear === null || actualCompletionYear > yearRange.end) {
      return false;
    }
  }
  return true;
}
function getYearRange(filters) {
  const hasStart = filters.startYear !== undefined && filters.startYear !== null && String(filters.startYear).trim() !== "";
  const hasStartFrom = filters.startYearFrom !== undefined && filters.startYearFrom !== null && String(filters.startYearFrom).trim() !== "";
  const hasEnd = filters.endYear !== undefined && filters.endYear !== null && String(filters.endYear).trim() !== "";
  if (!hasStart && !hasStartFrom && !hasEnd) return null;

  const start = hasStart ? Number(filters.startYear) : null;
  const startFrom = hasStartFrom ? Number(filters.startYearFrom) : null;
  const end = hasEnd ? Number(filters.endYear) : null;
  const invalid = (year) => year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100);
  if (invalid(start) || invalid(startFrom) || invalid(end)) throw new Error("Invalid year.");
  if (start !== null && startFrom !== null) {
    throw new Error("Use either startYear or startYearFrom, not both.");
  }
  if (start !== null && end !== null && start > end) {
    throw new Error("startYear cannot be greater than endYear.");
  }
  if (startFrom !== null && end !== null && startFrom > end) {
    throw new Error("startYearFrom cannot be greater than endYear.");
  }
  return { start, startFrom, end };
}
function buildIndexGroups(version, filters) {
  const groups = [];
  if (filters.condition?.trim()) groups.push([indexKey(version, "condition", filters.condition)]);
  if (filters.drug?.trim()) groups.push([indexKey(version, "intervention", filters.drug)]);
  if (filters.country?.trim()) groups.push([indexKey(version, "country", filters.country)]);
  if (filters.status?.trim()) groups.push([indexKey(version, "status", filters.status)]);
  if (filters.phase?.trim()) {
    const phase = filters.phase.trim().toUpperCase();
    if (!ALLOWED_PHASES.includes(phase)) throw new Error("Invalid study phase.");
    groups.push([indexKey(version, "phase", phase)]);
  }

  const yearRange = getYearRange(filters);
  if (yearRange) {
    if (yearRange.start !== null) {
      groups.push([indexKey(version, "year", String(yearRange.start))]);
    }
    if (yearRange.startFrom !== null) {
      const startYearKeys = [];
      for (let year = yearRange.startFrom; year <= 2100; year++) {
        startYearKeys.push(indexKey(version, "year", String(year)));
      }
      groups.push(startYearKeys);
    }
    if (yearRange.end !== null) {
      if (yearRange.start !== null) {
        groups.push([indexKey(version, "completionYear", String(yearRange.end))]);
      } else {
        const completionYearKeys = [];
        for (let year = 1900; year <= yearRange.end; year++) {
          completionYearKeys.push(indexKey(version, "completionYear", String(year)));
        }
        groups.push(completionYearKeys);
      }
    }
  }
  return groups;
}
function filtersFingerprint(filters) {
  const relevantFilters = {
    condition: normalize(filters.condition),
    drug: normalize(filters.drug),
    country: normalize(filters.country),
    status: normalize(filters.status),
    phase: normalize(filters.phase),
    startYear: filters.startYear || "",
    startYearFrom: filters.startYearFrom || "",
    endYear: filters.endYear || "",
  };
  return crypto.createHash("sha256").update(JSON.stringify(relevantFilters)).digest("hex");
}
function encodeToken(data) {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

function decodeToken(token) {
  try {
    return JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid pagination token. Please search again.");
  }
}

function matchesCountry(trial, country) {
  if (!country?.trim()) return true;
  return (trial.locations || []).some(
    (location) => normalize(location.country) === normalize(country),
  );
}

async function readLocalPage({
  resultKey,
  cursor,
  pendingIds = [],
  pageSize,
  totalCount,
  version,
  fingerprint,
  country,
}) {
  const ids = [...pendingIds];
  let nextCursor = Number(cursor ?? 0);
  let firstScan = ids.length === 0 && nextCursor === 0;

  while (ids.length < pageSize && (firstScan || nextCursor !== 0)) {
    firstScan = false;
    const page = await redisClient.sScan(resultKey, String(nextCursor), {
      COUNT: Math.max(pageSize - ids.length, 10),
    });
    nextCursor = Number(page.cursor);
    ids.push(...page.members);
  }

  const uniqueIds = [...new Set(ids)];
  const pageIds = uniqueIds.slice(0, pageSize);
  const remainingIds = uniqueIds.slice(pageSize);
  const records = await Promise.all(
    pageIds.map(async (id) => {
      const record = await redisClient.get(`${PREFIX}${id}`);
      if (!record) console.warn(`Missing trial record in Redis: ${id}`);
      return record;
    }),
  );

  let studies = records.filter(Boolean).map((record) => JSON.parse(record));
  if (country?.trim()) {
    const normalizedCountry = normalize(country);
    studies = studies
      .map((trial) => ({
        ...trial,
        locations: (trial.locations || []).filter(
          (location) => normalize(location.country) === normalizedCountry,
        ),
      }))
      .filter((trial) => trial.locations.length > 0);
  }

  const hasMore = remainingIds.length > 0 || nextCursor !== 0;
  const nextPageToken = hasMore
    ? encodeToken({ resultKey, cursor: nextCursor, pendingIds: remainingIds, version, fingerprint, totalCount })
    : null;
  return { totalCount, nextPageToken, studies };
}

async function searchLocalTrials(filters, version) {
  const groups = buildIndexGroups(version, filters);
  if (groups.length === 0) groups.push([`${PREFIX}index:${version}:meta:ids`]);
  const fingerprint = filtersFingerprint(filters);
  const pageSize = getPageSize(filters.pageSize);

  if (filters.pageToken) {
    const token = decodeToken(filters.pageToken);
    if (
      token.version !== version ||
      token.fingerprint !== fingerprint ||
      !Number.isInteger(token.cursor) ||
      token.cursor < 0 ||
      typeof token.resultKey !== "string" ||
      !token.resultKey.startsWith(SEARCH_PREFIX) ||
      !Number.isInteger(token.totalCount) ||
      (token.pendingIds !== undefined &&
        (!Array.isArray(token.pendingIds) || !token.pendingIds.every((id) => typeof id === "string")))
    ) {
      throw new Error("Pagination token does not match this search. Search again.");
    }
    if (!(await redisClient.exists(token.resultKey))) {
      throw new Error("Search results have expired. Please search again.");
    }
    await redisClient.expire(token.resultKey, CACHE_TTL_SECONDS);
    return readLocalPage({
      resultKey: token.resultKey,
      cursor: token.cursor,
      pendingIds: token.pendingIds || [],
      pageSize,
      totalCount: token.totalCount,
      version,
      fingerprint,
      country: filters.country,
    });
  }

  const resultKey = `${SEARCH_PREFIX}${crypto.randomUUID()}`;
  const temporaryYearKeys = [];
  try {
    const intersectionKeys = [];
    for (const group of groups) {
      if (group.length === 1) {
        intersectionKeys.push(group[0]);
        continue;
      }
      const yearUnionKey = `${YEAR_PREFIX}${crypto.randomUUID()}`;
      temporaryYearKeys.push(yearUnionKey);
      await redisClient.sUnionStore(yearUnionKey, group);
      await redisClient.expire(yearUnionKey, CACHE_TTL_SECONDS);
      intersectionKeys.push(yearUnionKey);
    }
    await redisClient.sInterStore(resultKey, intersectionKeys);
    await redisClient.expire(resultKey, CACHE_TTL_SECONDS);
    const totalCount = await redisClient.sCard(resultKey);
    return await readLocalPage({
      resultKey,
      cursor: 0,
      pendingIds: [],
      pageSize,
      totalCount,
      version,
      fingerprint,
      country: filters.country,
    });
  } finally {
    if (temporaryYearKeys.length > 0) {
      await redisClient.del(temporaryYearKeys).catch((error) => {
        console.warn("Temporary year-index cleanup failed:", error.message);
      });
    }
  }
}

async function searchExternalTrials(filters = {}) {
  if (!API_BASE_URL) throw new Error("CLINICAL_TRIALS_API_URL is missing from the environment.");
  const params = new URLSearchParams();
  const advancedFilters = [];
  if (filters.condition?.trim()) params.set("query.cond", filters.condition.trim());
  if (filters.drug?.trim()) params.set("query.intr", filters.drug.trim());
  if (filters.country?.trim()) advancedFilters.push(`AREA[LocationCountry]"${filters.country.trim()}"`);
  if (filters.status?.trim()) params.set("filter.overallStatus", filters.status.trim());
  if (filters.phase?.trim()) {
    const phase = filters.phase.trim().toUpperCase();
    if (!ALLOWED_PHASES.includes(phase)) throw new Error("Invalid study phase.");
    advancedFilters.push(`AREA[Phase]${phase}`);
  }

  const yearRange = getYearRange(filters);
  if (yearRange?.start !== null && yearRange?.start !== undefined) {
    advancedFilters.push(`AREA[StartDate]RANGE[${yearRange.start}-01-01,${yearRange.start}-12-31]`);
  }
  if (yearRange?.startFrom !== null && yearRange?.startFrom !== undefined) {
    advancedFilters.push(`AREA[StartDate]RANGE[${yearRange.startFrom}-01-01,MAX]`);
  }
  if (yearRange?.end !== null && yearRange?.end !== undefined) {
    const completionStartYear = yearRange.start !== null ? yearRange.end : 1900;
    advancedFilters.push(`AREA[CompletionDate]RANGE[${completionStartYear}-01-01,${yearRange.end}-12-31]`);
  }  if (advancedFilters.length > 0) params.set("filter.advanced", advancedFilters.join(" AND "));
  params.set("pageSize", String(getPageSize(filters.pageSize)));
  params.set("countTotal", "true");
  if (filters.pageToken) params.set("pageToken", filters.pageToken);

  const url = `${API_BASE_URL}?${params.toString()}`;
  const cacheKey = `${PREFIX}${crypto.createHash("sha256").update(url).digest("hex")}`;
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) return JSON.parse(cachedData);
  } catch (error) {
    console.warn("Redis cache read failed:", error.message);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`ClinicalTrials.gov API returned HTTP ${response.status}`);
    const data = await response.json();
    const normalizedStudies = (data.studies || []).map(normalizeTrial);
    const result = {
      totalCount: data.totalCount ?? 0,
      nextPageToken: data.nextPageToken || null,
      studies: filters.country?.trim()
        ? normalizedStudies
            .map((trial) => ({
              ...trial,
              locations: (trial.locations || []).filter(
                (location) => normalize(location.country) === normalize(filters.country),
              ),
            }))
            .filter((trial) => trial.locations.length > 0)
        : normalizedStudies,
    };
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));
    } catch (error) {
      console.warn("Redis cache write failed:", error.message);
    }
    return result;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("ClinicalTrials.gov request timed out after 10 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
async function searchTrials(filters = {}) {
  if (redisClient.isReady) {
    const version = await redisClient.get(ACTIVE_INDEX_KEY);

    if (version) {
      console.log(
        "Searching Redis indexes:",
        Object.keys(filters).filter(
          (key) =>
            [
              "condition",
              "drug",
              "country",
              "status",
              "phase",
              "startYear",
              "startYearFrom",
              "endYear",
            ].includes(key) && String(filters[key] || "").trim(),
        ),
      );

      return searchLocalTrials(filters, version);
    }

    throw new Error(
      "Redis trial indexes are not ready. Complete the index build first.",
    );
  }

  throw new Error(
    "Redis is unavailable. Start Redis before searching the local dataset.",
  );
}

module.exports = { searchTrials };
