const express = require("express");
const loginrequired = require("../middleware/auth");
const insights = require("../controllers/insightsController");

const router = express.Router();

router.get("/insights", loginrequired, insights.show);

module.exports = router;
