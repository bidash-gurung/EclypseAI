const express = require("express");
const {
  getCountriesController,
} = require("../controllers/countriesController");

const router = express.Router();

router.get("/", getCountriesController);

module.exports = router;
