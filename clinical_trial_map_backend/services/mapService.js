const crypto = require("crypto");
const { redisClient } = require("../configs/redis");

const PREFIX = "clinical-trials:";
const ACTIVE_INDEX_KEY = `${PREFIX}index:active`;
const SEARCH_PREFIX = `${PREFIX}search:results:`;
const YEAR_PREFIX = `${PREFIX}search:years:`;
const MAP_CACHE_PREFIX = `${PREFIX}map:v3:`;
const CLUSTER_CACHE_PREFIX = `${PREFIX}cluster:v3:`;

const CACHE_TTL_SECONDS = 60 * 60;
const BATCH_SIZE = 500;
const GRID_PRECISION = 1;

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

function getYearRange(filters) {
  const hasStart = filters.startYear !== undefined && filters.startYear !== null && String(filters.startYear).trim() !== "";
  const hasStartFrom = filters.startYearFrom !== undefined && filters.startYearFrom !== null && String(filters.startYearFrom).trim() !== "";
  const hasEnd = filters.endYear !== undefined && filters.endYear !== null && String(filters.endYear).trim() !== "";
  if (!hasStart && !hasStartFrom && !hasEnd) return null;

  const start = hasStart ? Number(filters.startYear) : null;
  const startFrom = hasStartFrom ? Number(filters.startYearFrom) : null;
  const end = hasEnd ? Number(filters.endYear) : null;
  const invalid = (year) => year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100);
  if (
    invalid(start) || invalid(startFrom) || invalid(end) ||
    (start !== null && startFrom !== null) ||
    (start !== null && end !== null && start > end) ||
    (startFrom !== null && end !== null && startFrom > end)
  ) {
    throw new Error("Invalid startYear/endYear range.");
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
async function getMatchingResultKey(version, filters) {
  const groups = buildIndexGroups(version, filters);

  if (groups.length === 0) {
    return `${PREFIX}index:${version}:meta:ids`;
  }

  const intersectionKeys = [];
  const temporaryKeys = [];

  try {
    for (const group of groups) {
      if (group.length === 1) {
        intersectionKeys.push(group[0]);
      } else {
        const unionKey = `${YEAR_PREFIX}${crypto.randomUUID()}`;
        temporaryKeys.push(unionKey);

        await redisClient.sUnionStore(unionKey, group);
        intersectionKeys.push(unionKey);
      }
    }

    const resultKey = `${SEARCH_PREFIX}map-${crypto.randomUUID()}`;

    await redisClient.sInterStore(resultKey, intersectionKeys);
    await redisClient.expire(resultKey, CACHE_TTL_SECONDS);

    return resultKey;
  } finally {
    if (temporaryKeys.length) {
      await redisClient.del(temporaryKeys).catch(() => {});
    }
  }
}

function makeCacheKey(version, filters) {
  const relevant = {};

  for (const key of [
    "condition",
    "drug",
    "country",
    "status",
    "phase",
    "startYear",
    "startYearFrom",
    "endYear",
  ]) {
    relevant[key] = normalize(filters[key]);
  }

  return `${MAP_CACHE_PREFIX}${version}:${crypto
    .createHash("sha256")
    .update(JSON.stringify(relevant))
    .digest("hex")}`;
}

function makeClusterCacheKey(
  version,
  latitude,
  longitude,
  filters,
  limit,
  offset,
) {
  const relevant = {};

  for (const key of [
    "condition",
    "drug",
    "country",
    "status",
    "phase",
    "startYear",
    "startYearFrom",
    "endYear",
  ]) {
    relevant[key] = normalize(filters[key]);
  }

  relevant.latitude = latitude;
  relevant.longitude = longitude;
  relevant.limit = limit;
  relevant.offset = offset;

  return `${CLUSTER_CACHE_PREFIX}${version}:${crypto
    .createHash("sha256")
    .update(JSON.stringify(relevant))
    .digest("hex")}`;
}

function validCoordinates(location) {
  if (location?.latitude == null || location?.longitude == null) {
    return false;
  }

  const lat = Number(location.latitude);
  const lon = Number(location.longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function matchesCell(location, latCell, lonCell) {
  if (!validCoordinates(location)) return false;

  const lat = Number(location.latitude);
  const lon = Number(location.longitude);

  return (
    Math.floor(lat / GRID_PRECISION) * GRID_PRECISION === latCell &&
    Math.floor(lon / GRID_PRECISION) * GRID_PRECISION === lonCell
  );
}

function matchesStatus(trial, filters) {
  return (
    !filters.status?.trim() ||
    normalize(trial.status) === normalize(filters.status)
  );
}
function matchesCountry(location, filters) {
  return (
    !filters.country?.trim() ||
    normalize(location.country) === normalize(filters.country)
  );
}

function toTrialLocation(trial, location) {
  return {
    nctId: trial.nctId,
    title: trial.title,
    briefSummary: trial.briefSummary,
    phase: trial.phase,
    status: trial.status,
    sponsor: trial.sponsor,
    startDate: trial.startDate,
    completionDate: trial.completionDate,
    url: trial.url,
    location: {
      facility: location.facility,
      city: location.city,
      state: location.state,
      country: location.country,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
    },
  };
}

async function getMapData(filters = {}) {
  if (!redisClient.isReady) {
    throw new Error("Redis is unavailable.");
  }

  const version = await redisClient.get(ACTIVE_INDEX_KEY);

  if (!version) {
    throw new Error("Redis trial indexes are not ready.");
  }

  const cacheKey = makeCacheKey(version, filters);
  const cached = await redisClient.get(cacheKey);

  if (cached) return JSON.parse(cached);

  const resultKey = await getMatchingResultKey(version, filters);
  const isTemporary = resultKey.startsWith(`${SEARCH_PREFIX}map-`);

  try {
    let totalTrials = 0;
    const clusters = new Map();
    let totalLocations = 0;
    let cursor = "0";

    do {
      const page = await redisClient.sScan(resultKey, cursor, {
        COUNT: BATCH_SIZE,
      });

      cursor = String(page.cursor);

      const records = await Promise.all(
        page.members.map((id) => redisClient.get(`${PREFIX}${id}`)),
      );

      for (const record of records) {
        if (!record) continue;

        const trial = JSON.parse(record);
        if (!matchesStatus(trial, filters)) continue;
        totalTrials++;

        for (const location of trial.locations || []) {
          if (!validCoordinates(location)) continue;
          if (!matchesCountry(location, filters)) continue;

          const latitude = Number(location.latitude);
          const longitude = Number(location.longitude);

          totalLocations++;

          const latCell =
            Math.floor(latitude / GRID_PRECISION) * GRID_PRECISION;
          const lonCell =
            Math.floor(longitude / GRID_PRECISION) * GRID_PRECISION;
          const key = `${latCell}:${lonCell}`;

          if (!clusters.has(key)) {
            clusters.set(key, {
              latitude: latCell + GRID_PRECISION / 2,
              longitude: lonCell + GRID_PRECISION / 2,
              locationCount: 0,
              trialIds: new Set(),
            });
          }

          const cluster = clusters.get(key);
          cluster.locationCount++;

          if (trial.nctId) cluster.trialIds.add(trial.nctId);
        }
      }
    } while (cursor !== "0");

    const points = Array.from(clusters.values(), (cluster) => ({
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      locationCount: cluster.locationCount,
      trialCount: cluster.trialIds.size,
    }));

    const result = {
      success: true,
      totalTrials,
      totalLocations,
      totalClusters: points.length,
      precisionDegrees: GRID_PRECISION,
      points,
    };

    await redisClient.setEx(
      cacheKey,
      CACHE_TTL_SECONDS,
      JSON.stringify(result),
    );

    return result;
  } finally {
    if (isTemporary) {
      await redisClient.del(resultKey).catch(() => {});
    }
  }
}

async function getClusterDetails(filters = {}) {
  if (!redisClient.isReady) {
    throw new Error("Redis is unavailable.");
  }

  const latitude = Number(filters.latitude);
  const longitude = Number(filters.longitude);

  if (
    filters.latitude === undefined ||
    filters.longitude === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Invalid cluster coordinates.");
  }

  const limit = Math.min(
    Math.max(Number.parseInt(filters.limit, 10) || 50, 1),
    100,
  );

  const offset = Math.max(Number.parseInt(filters.offset, 10) || 0, 0);

  const version = await redisClient.get(ACTIVE_INDEX_KEY);

  if (!version) {
    throw new Error("Redis trial indexes are not ready.");
  }

  // Convert the map marker center back to its geographic cell.
  const latCell = Math.round(latitude / GRID_PRECISION - 0.5) * GRID_PRECISION;
  const lonCell = Math.round(longitude / GRID_PRECISION - 0.5) * GRID_PRECISION;

  const centerLatitude = latCell + GRID_PRECISION / 2;
  const centerLongitude = lonCell + GRID_PRECISION / 2;

  const cacheKey = makeClusterCacheKey(
    version,
    centerLatitude,
    centerLongitude,
    filters,
    limit,
    offset,
  );

  const cached = await redisClient.get(cacheKey);

  if (cached) return JSON.parse(cached);

  const geoKey = indexKey(version, "geo", `${latCell}:${lonCell}`);
  const geoExists = await redisClient.exists(geoKey);

  if (!geoExists) {
    const result = {
      success: true,
      cluster: {
        latitude: centerLatitude,
        longitude: centerLongitude,
      },
      totalLocations: 0,
      returnedLocations: 0,
      limit,
      offset,
      hasMore: false,
      trials: [],
    };

    await redisClient.setEx(
      cacheKey,
      CACHE_TTL_SECONDS,
      JSON.stringify(result),
    );

    return result;
  }

  const matchingKey = await getMatchingResultKey(version, filters);
  const isTemporary = matchingKey.startsWith(`${SEARCH_PREFIX}map-`);

  try {
    // Intersect the selected geographic cell with active filter results.
    const candidateKey = `${SEARCH_PREFIX}cluster-${crypto.randomUUID()}`;

    try {
      await redisClient.sInterStore(candidateKey, geoKey, matchingKey);

      let totalCandidateTrials = 0;
      const trials = [];
      let totalLocations = 0;
      let cursor = "0";

      // Scan all candidate trials to obtain an accurate location count.
      // Keep only the requested page in memory.
      do {
        const page = await redisClient.sScan(candidateKey, cursor, {
          COUNT: BATCH_SIZE,
        });

        cursor = String(page.cursor);

        const records = await Promise.all(
          page.members.map((id) => redisClient.get(`${PREFIX}${id}`)),
        );

        for (const record of records) {
          if (!record) continue;

          const trial = JSON.parse(record);
          if (!matchesStatus(trial, filters)) continue;
          totalCandidateTrials++;

          for (const location of trial.locations || []) {
            if (!matchesCell(location, latCell, lonCell)) continue;
            if (!matchesCountry(location, filters)) continue;

            const currentIndex = totalLocations;
            totalLocations++;

            if (currentIndex >= offset && trials.length < limit) {
              trials.push(toTrialLocation(trial, location));
            }
          }
        }
      } while (cursor !== "0");

      const result = {
        success: true,
        cluster: {
          latitude: centerLatitude,
          longitude: centerLongitude,
        },
        totalLocations,
        totalCandidateTrials,
        returnedLocations: trials.length,
        limit,
        offset,
        hasMore: offset + trials.length < totalLocations,
        trials,
      };

      await redisClient.setEx(
        cacheKey,
        CACHE_TTL_SECONDS,
        JSON.stringify(result),
      );

      return result;
    } finally {
      await redisClient.del(candidateKey).catch(() => {});
    }
  } finally {
    if (isTemporary) {
      await redisClient.del(matchingKey).catch(() => {});
    }
  }
}

module.exports = {
  getMapData,
  getClusterDetails,
};
