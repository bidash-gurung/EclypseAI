const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (error) => {
  console.error("Redis error:", error.message);
});

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  console.log("Redis connected successfully");
}

module.exports = {
  redisClient,
  connectRedis,
};
