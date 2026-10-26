const express = require("express");
const loginrequired = require("../middleware/auth");
const games = require("../controllers/gameController");

const router = express.Router();

router.get("/games", loginrequired, games.list);
router.get("/games/:id", loginrequired, games.show);
router.post("/games/:id/delete", loginrequired, games.remove);
router.post("/games/:id/edit", loginrequired, games.updateNotes);
router.post("/games/:id/side", loginrequired, games.setSide);

module.exports = router;
