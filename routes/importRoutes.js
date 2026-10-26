const express = require("express");
const loginrequired = require("../middleware/auth");
const imports = require("../controllers/importController");

const router = express.Router();

router.get("/import", loginrequired, imports.importForm);
router.post("/games", loginrequired, imports.importPgn);
router.post("/import/online", loginrequired, imports.importOnline);

module.exports = router;
