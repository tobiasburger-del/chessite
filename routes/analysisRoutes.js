const express = require("express");
const loginrequired = require("../middleware/auth");
const analysis = require("../controllers/analysisController");

const router = express.Router();

router.post(
  "/games/:id/analysis",
  loginrequired,
  express.json({ limit: "1mb" }),
  analysis.save,
);

module.exports = router;
