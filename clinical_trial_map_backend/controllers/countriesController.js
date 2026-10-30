const { getCountries } = require("../services/countryService");

async function getCountriesController(req, res) {
  try {
    const countries = await getCountries();

    return res.status(200).json({
      success: true,
      count: countries.length,
      countries,
    });
  } catch (error) {
    console.error("Error fetching countries:", error.message);

    return res.status(502).json({
      success: false,
      message: "Failed to fetch countries from ClinicalTrials.gov.",
    });
  }
}

module.exports = { getCountriesController };
