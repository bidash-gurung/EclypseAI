const express = require("express");
const {
  getMap,
  getMapClusterDetails,
} = require("../controllers/mapController");

const router = express.Router();

router.get("/cluster-details", getMapClusterDetails);
router.get("/", getMap);

module.exports = router;
