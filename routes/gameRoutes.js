const express = require("express");
const loginrequired = require("../middleware/auth");
const games = require("../controllers/gameController");

const router = express.Router();

router.get("/games", loginrequired, games.list);
router.post("/games", loginrequired, games.create);
router.get("/games/:id", loginrequired, games.show);
router.post("/games/:id/delete", loginrequired, games.remove);
router.post("/games/:id/edit", loginrequired, games.updateNotes);
router.get("/import", loginrequired, games.importForm);

module.exports = router;
