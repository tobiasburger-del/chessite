const express = require("express");
const loginrequired = require("../middleware/auth");
const play = require("../controllers/playController");

const router = express.Router();

router.get("/play", loginrequired, play.show);
router.post("/play/games", loginrequired, express.json({ limit: "200kb" }), play.save);

module.exports = router;
