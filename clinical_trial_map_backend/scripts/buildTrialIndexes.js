const crypto = require("crypto");
const { redisClient, connectRedis } = require("../configs/redis");

const PREFIX = "clinical-trials:";
const COMPLETE_KEY = `${PREFIX}sync:complete`;
const ACTIVE_INDEX_KEY = `${PREFIX}index:active`;
const LOCK_KEY = `${PREFIX}index:build:lock`;

const BATCH_SIZE = 100;
const SCAN_COUNT = 500;
const GRID_PRECISION = 1;

const INDEX_VERSION = `v${Date.now()}`;

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function indexKey(type, value) {
  return `${PREFIX}index:${INDEX_VERSION}:${type}:${encodeURIComponent(
    normalize(value),
  )}`;
}

function validCoordinates(location) {
  if (location?.latitude == null || location?.longitude == null) {
    return false;
  }

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

async function buildTrialIndexes() {
  if (!redisClient.isReady) {
    throw new Error("Redis is not ready.");
  }

  if ((await redisClient.get(COMPLETE_KEY)) !== "true") {
    throw new Error("The source dataset is not marked complete.");
  }

  const lockToken = crypto.randomUUID();

  const acquired = await redisClient.set(LOCK_KEY, lockToken, {
    NX: true,
    EX: 21600,
  });

  if (acquired !== "OK") {
    throw new Error("Another index build is already running.");
  }

  let cursor = "0";
  let scanned = 0;
  let indexed = 0;
  let skipped = 0;
  let queued = 0;
  let batch = redisClient.multi();

  const idsKey = indexKey("meta", "ids");
  const versionMetaKey = `${PREFIX}index:${INDEX_VERSION}:meta:state`;

  try {
    console.log(`Building Redis indexes: ${INDEX_VERSION}`);

    do {
      const result = await redisClient.scan(cursor, {
        MATCH: `${PREFIX}NCT*`,
        COUNT: SCAN_COUNT,
      });

      cursor = String(result.cursor);

      for (const key of result.keys) {
        scanned++;

        const raw = await redisClient.get(key);

        if (!raw) {
          skipped++;
          continue;
        }

        let trial;

        try {
          trial = JSON.parse(raw);
        } catch {
          console.warn(`Skipping invalid JSON: ${key}`);
          skipped++;
          continue;
        }

        if (!trial?.nctId) {
          skipped++;
          continue;
        }

        const id = trial.nctId;

        const add = (type, value) => {
          if (value === null || value === undefined || !String(value).trim()) {
            return;
          }

          batch.sAdd(indexKey(type, value), id);
          queued++;
        };

        // Index all trial IDs.
        batch.sAdd(idsKey, id);
        queued++;

        // Index trial metadata.
        add("status", trial.status);

        for (const phase of trial.phases || []) {
          add("phase", phase);
        }

        for (const condition of trial.conditions || []) {
          add("condition", condition);
        }

        for (const intervention of trial.interventions || []) {
          add("intervention", intervention?.name);
        }

        // Index each location.
        for (const location of trial.locations || []) {
          add("country", location?.country);

          if (!validCoordinates(location)) {
            continue;
          }

          const latitude = Number(location.latitude);
          const longitude = Number(location.longitude);

          const latCell = Math.floor(latitude / GRID_PRECISION);

          const lonCell = Math.floor(longitude / GRID_PRECISION);

          // A trial can have multiple locations in different cells.
          // Redis sets automatically prevent duplicate trial IDs
          // within the same geographic cell.
          add("geo", `${latCell}:${lonCell}`);
        }

        // Preserve the existing start-year indexing behavior.

        // Index the trial's start year.

        // Index the start year.
        if (trial.startDate) {
          const match = String(trial.startDate).match(/^(\d{4})/);

          if (match) {
            add("year", match[1]);
          }
        }

        // Index the completion year.
        if (trial.completionDate) {
          const match = String(trial.completionDate).match(/^(\d{4})/);

          if (match) {
            add("completionYear", match[1]);
          }
        }

        indexed++;

        if (queued >= BATCH_SIZE) {
          await batch.exec();
          batch = redisClient.multi();
          queued = 0;
        }

        if (scanned % 5000 === 0) {
          console.log(
            `Scanned ${scanned}; indexed ${indexed}; skipped ${skipped}`,
          );
        }
      }
    } while (cursor !== "0");

    if (queued > 0) {
      await batch.exec();
    }

    // Mark this index version ready before activation.
    await redisClient.set(
      versionMetaKey,
      JSON.stringify({
        state: "ready",
        scanned,
        indexed,
        skipped,
        gridPrecision: GRID_PRECISION,
        completedAt: new Date().toISOString(),
      }),
    );

    // Activate only after the complete index has been built.
    await redisClient.set(ACTIVE_INDEX_KEY, INDEX_VERSION);

    console.log("Index build completed successfully.");
    console.log({
      version: INDEX_VERSION,
      scanned,
      indexed,
      skipped,
      gridPrecision: GRID_PRECISION,
    });
  } catch (error) {
    console.error("Index build failed:", error.message);
    console.error(
      `Partial version ${INDEX_VERSION} was not activated. ` +
        "Its keys have been retained for inspection.",
    );

    throw error;
  } finally {
    // Release only the lock acquired by this process.
    await redisClient
      .eval(
        `if redis.call("GET", KEYS[1]) == ARGV[1] then
           return redis.call("DEL", KEYS[1])
         else
           return 0
         end`,
        {
          keys: [LOCK_KEY],
          arguments: [lockToken],
        },
      )
      .catch((error) => {
        console.error("Failed to release index lock:", error.message);
      });
  }
}

if (require.main === module) {
  console.log("Starting index builder...");

  connectRedis()
    .then(() => buildTrialIndexes())
    .then(() => {
      console.log("Index builder finished successfully.");
    })
    .catch((error) => {
      console.error("INDEX BUILD ERROR:");
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (redisClient.isOpen) {
        await redisClient.quit();
      }
    });
}

module.exports = { buildTrialIndexes };
