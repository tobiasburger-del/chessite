const User = require("../models/user");
const Game = require("../models/game");
const Drill = require("../models/drill");
const { isValidUsername } = require("../utils/usernames");

async function show(req, res) {
  const user = await User.findById(req.session.userId);
  res.render("settings", {
    userId: req.session.userId,
    user,
    error: null,
    saved: req.query.saved === "1",
  });
}

async function update(req, res) {
  const userId = req.session.userId;
  const lichess = (req.body.lichess_username || "").trim();
  const chesscom = (req.body.chesscom_username || "").trim();

  if ([lichess, chesscom].some((name) => name && !isValidUsername(name))) {
    const user = { ...(await User.findById(userId)), lichess_username: lichess, chesscom_username: chesscom };
    return res.status(400).render("settings", {
      userId,
      user,
      error: "Usernames can only contain letters, numbers, _ and -.",
      saved: false,
    });
  }

  await User.updateUsernames(userId, lichess, chesscom);
  // Games imported before the usernames were set now learn which side you played.
  await Game.recomputeUserColors(userId, [lichess, chesscom].filter(Boolean));
  await Drill.syncForUser(userId);
  res.redirect("/settings?saved=1");
}

module.exports = { show, update };
