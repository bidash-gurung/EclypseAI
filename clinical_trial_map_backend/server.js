require("dotenv").config();
const { connectRedis } = require("./configs/redis");
const clinicalTrialsRoutes = require("./routes/clinicalTrialsRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const clinicalTrialsMetaRoutes = require("./routes/clinicalTrialsMetaRoutes");
const countriesRoutes = require("./routes/countriesRoutes");
const mapRoutes = require("./routes/mapRoute");
const aiSearchRoutes = require("./routes/aiSearchRoutes");
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// Routing List
app.use("/api/trials", clinicalTrialsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/clinical-trials", clinicalTrialsMetaRoutes);
app.use("/api/clinical-trials/countries", countriesRoutes);
app.use("/api/trials/map", mapRoutes);
app.use("/api/ai/search", aiSearchRoutes);
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectRedis();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);

      // Start dataset ingestion in the background.
      const { syncClinicalTrials } = require("./scripts/syncClinicalTrials");

      syncClinicalTrials().catch((error) => {
        console.error("Clinical trials sync failed:", error.message);
      });
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
