const express = require("express");
const {
  fetchClinicalTrialsEndpoint,
} = require("../services/clinicalTrialsMetaService");
const {
  getTrialDetails,
} = require("../controllers/clinicalTrialDetailsController");
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

// router.get("/stats/size", (req, res) => proxyEndpoint(req, res, "stats/size"));

// router.get("/stats/field/values", (req, res) => {
//   const fields = req.query.fields;

//   if (!fields || typeof fields !== "string") {
//     return res.status(400).json({
//       success: false,
//       message: "Provide the fields query parameter.",
//     });
//   }

//   const params = new URLSearchParams({ fields });

//   return proxyEndpoint(req, res, `stats/field/values?${params.toString()}`);
// });

// router.get("/stats/field/sizes", (req, res) =>
//   proxyEndpoint(req, res, "stats/field/sizes"),
// );

router.get("/version", (req, res) => proxyEndpoint(req, res, "version"));

// router.get("/studies/metadata", (req, res) => {
//   const params = new URLSearchParams();

//   if (req.query.includeIndexedOnly === "true") {
//     params.set("includeIndexedOnly", "true");
//   }

//   if (req.query.includeHistoricOnly === "true") {
//     params.set("includeHistoricOnly", "true");
//   }

//   const query = params.toString();
//   const path = `studies/metadata${query ? `?${query}` : ""}`;

//   return proxyEndpoint(req, res, path);
// });

// router.get("/studies/search-areas", (req, res) =>
//   proxyEndpoint(req, res, "studies/search-areas"),
// );

router.get("/studies/enums", (req, res) =>
  proxyEndpoint(req, res, "studies/enums"),
);

// router.get("/studies/:nctId", getTrialDetails);
module.exports = router;
