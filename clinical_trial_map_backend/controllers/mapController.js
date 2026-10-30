const { getMapData, getClusterDetails } = require("../services/mapService");

async function getMap(req, res) {
  try {
    const result = await getMapData(req.query);

    res.json(result);
  } catch (error) {
    console.error("Map API error:", error);

    const clientErrors = [
      "Invalid startYear/endYear range.",
      "Invalid study phase.",
    ];

    const status = clientErrors.includes(error.message) ? 400 : 500;

    res.status(status).json({
      success: false,
      message: error.message || "Unable to load map data.",
    });
  }
}

async function getMap(req, res) {
  try {
    const result = await getMapData(req.query);
    res.json(result);
  } catch (error) {
    console.error("Map API error:", error);

    const clientErrors = [
      "Invalid startYear/endYear range.",
      "Invalid study phase.",
    ];

    const status = clientErrors.includes(error.message) ? 400 : 500;

    res.status(status).json({
      success: false,
      message: error.message || "Unable to load map data.",
    });
  }
}

async function getMapClusterDetails(req, res) {
  try {
    const result = await getClusterDetails(req.query);
    res.json(result);
  } catch (error) {
    console.error("Map cluster API error:", error);

    const clientErrors = [
      "Invalid startYear/endYear range.",
      "Invalid study phase.",
      "Invalid cluster coordinates.",
    ];

    const status = clientErrors.includes(error.message) ? 400 : 500;

    res.status(status).json({
      success: false,
      message: error.message || "Unable to load cluster details.",
    });
  }
}

module.exports = {
  getMap,
  getMapClusterDetails,
};
