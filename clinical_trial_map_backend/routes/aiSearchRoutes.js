const express = require("express");
const { postAISearch } = require("../controllers/aiSearchController");

const router = express.Router();

router.post("/", postAISearch);

module.exports = router;
