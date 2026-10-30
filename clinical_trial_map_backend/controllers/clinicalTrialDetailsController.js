const {
  fetchClinicalTrialsEndpoint,
} = require("../services/clinicalTrialsMetaService");

async function getTrialDetails(req, res) {
  try {
    const { nctId } = req.params;

    if (!/^NCT\d{8}$/.test(nctId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid clinical trial ID.",
      });
    }

    const data = await fetchClinicalTrialsEndpoint(
      `studies/${encodeURIComponent(nctId)}`,
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Failed to fetch trial details:", error.message);

    return res.status(502).json({
      success: false,
      message: "Failed to fetch clinical trial details.",
    });
  }
}

module.exports = { getTrialDetails };
