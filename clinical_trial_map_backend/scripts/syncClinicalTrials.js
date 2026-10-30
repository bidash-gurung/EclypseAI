const axios = require("axios");
const crypto = require("crypto");
const { redisClient } = require("../configs/redis");
const { normalizeTrial } = require("../utils/normalizeTrial");

const API_URL = process.env.CLINICAL_TRIALS_API_URL;

const PAGE_SIZE = 1000;
const BATCH_SIZE = 200;
const REQUEST_TIMEOUT_MS = 30000;

const PREFIX = "clinical-trials:";
const PROGRESS_KEY = "clinical-trials:sync:progress";
const COMPLETE_KEY = "clinical-trials:sync:complete";
const LOCK_KEY = "clinical-trials:sync:lock";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(pageToken) {
  const params = {
    pageSize: PAGE_SIZE,
    countTotal: true,
  };

  if (pageToken) {
    params.pageToken = pageToken;
  }

  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(API_URL, {
        params,
        timeout: REQUEST_TIMEOUT_MS,
      });

      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const retryable = !status || status === 429 || status >= 500;

      if (!retryable || attempt === maxAttempts) {
        throw error;
      }

      const delay = Math.min(1000 * 2 ** (attempt - 1), 30000);
      console.warn(
        `API request failed (attempt ${attempt}/${maxAttempts}). ` +
          `Retrying in ${delay / 1000}s...`,
      );

      await sleep(delay);
    }
  }
}

async function saveBatch(studies) {
  const multi = redisClient.multi();
  let validCount = 0;

  for (const study of studies) {
    const trial = normalizeTrial(study);

    if (!trial?.nctId) {
      continue;
    }

    const key = `${PREFIX}${trial.nctId}`;

    // Permanent individual trial record; no TTL.
    multi.set(key, JSON.stringify(trial));
    validCount++;
  }

  if (validCount > 0) {
    await multi.exec();
  }

  return validCount;
}

async function syncClinicalTrials() {
  if (!redisClient.isReady) {
    throw new Error("Redis is not ready.");
  }

  if (!API_URL) {
    throw new Error("CLINICAL_TRIALS_API_URL is missing.");
  }

  // Skip only after a previous import completed successfully.
  if ((await redisClient.get(COMPLETE_KEY)) === "true") {
    console.log("Clinical trials dataset is already fully imported.");
    return;
  }

  // Prevent two ingestion jobs from running at once.
  const lockToken = crypto.randomUUID();

  const acquired = await redisClient.set(LOCK_KEY, lockToken, {
    NX: true,
    EX: 3600,
  });

  if (acquired !== "OK") {
    console.log("Another ingestion job is already running.");
    return;
  }

  try {
    const savedProgress = await redisClient.get(PROGRESS_KEY);
    let pageToken = savedProgress || null;
    let processed = 0;
    let pages = 0;
    let totalCount = null;

    console.log("Starting ClinicalTrials.gov ingestion...");

    while (true) {
      const page = await fetchPage(pageToken);

      const studies = page.studies || [];

      if (totalCount === null) {
        totalCount = page.totalCount ?? null;
      }

      // Save records before advancing the checkpoint.
      for (let i = 0; i < studies.length; i += BATCH_SIZE) {
        const batch = studies.slice(i, i + BATCH_SIZE);
        processed += await saveBatch(batch);
      }

      pages++;

      const nextToken = page.nextPageToken || null;

      // Checkpoint only after the current page has been saved.
      if (nextToken) {
        await redisClient.set(PROGRESS_KEY, nextToken);
      } else {
        await redisClient.del(PROGRESS_KEY);
      }

      console.log(
        `Pages fetched: ${pages}; ` +
          `records processed this run: ${processed}; ` +
          `API total: ${totalCount ?? "unknown"}`,
      );

      if (!nextToken) {
        break;
      }

      pageToken = nextToken;
    }

    // Set completion flag only after all pages succeed.
    await redisClient.set(COMPLETE_KEY, "true");

    console.log(`Import completed. Processed ${processed} records this run.`);
  } catch (error) {
    console.error("Clinical trials ingestion failed:", error.message);
    console.error("Progress is retained where possible; retry the sync.");
    throw error;
  } finally {
    // Release only our own lock.
    await redisClient.eval(
      `if redis.call("GET", KEYS[1]) == ARGV[1] then
         return redis.call("DEL", KEYS[1])
       else
         return 0
       end`,
      {
        keys: [LOCK_KEY],
        arguments: [lockToken],
      },
    );
  }
}

module.exports = { syncClinicalTrials };
