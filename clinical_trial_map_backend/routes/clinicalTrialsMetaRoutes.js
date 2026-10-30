const express = require("express");
const {
  fetchClinicalTrialsEndpoint,
} = require("../services/clinicalTrialsMetaService");
const router = express.Router();

async function proxyEndpoint(req, res, path) {
  try {
    const data = await fetchClinicalTrialsEndpoint(path);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(`ClinicalTrials.gov ${path} error:`, error.message);

    return res.status(502).json({
      success: false,
      message: "Failed to retrieve data from ClinicalTrials.gov.",
    });
  }
}

router.get("/version", (req, res) => proxyEndpoint(req, res, "version"));
router.get("/studies/enums", (req, res) =>
  proxyEndpoint(req, res, "studies/enums"),
);

module.exports = router;
