const express = require("express");
const loginrequired = require("../middleware/auth");
const train = require("../controllers/trainController");

const router = express.Router();

router.get("/train", loginrequired, train.show);
router.get("/train/queue", loginrequired, train.queue);
router.post("/train/:id/result", loginrequired, express.json(), train.result);

module.exports = router;
