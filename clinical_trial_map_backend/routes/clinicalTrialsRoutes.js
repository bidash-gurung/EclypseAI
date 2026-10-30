const express = require("express");
const { getTrials } = require("../controllers/clinicalTrialsController");

const router = express.Router();

router.get("/", getTrials);

module.exports = router;
