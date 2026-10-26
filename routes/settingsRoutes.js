const express = require("express");
const loginrequired = require("../middleware/auth");
const settings = require("../controllers/settingsController");

const router = express.Router();

router.get("/settings", loginrequired, settings.show);
router.post("/settings", loginrequired, settings.update);

module.exports = router;
