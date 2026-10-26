const express = require("express");
const today = require("../controllers/todayController");

const router = express.Router();

// Logged in: the Today page. Logged out: the landing page.
router.get("/", (req, res, next) => {
  if (req.session.userId) return today.show(req, res, next);
  res.render("index", { userId: null });
});

module.exports = router;
