const User = require("../models/user");
const Game = require("../models/game");
const Drill = require("../models/drill");
const Insights = require("../models/insights");
const { setupSteps } = require("../utils/today");
const { buildInsights } = require("../utils/insights");
const { outcomeFor } = require("../utils/pgn-parser");

// The logged-in home page: a setup checklist until you've done the whole
// loop once, then what to do today.
async function show(req, res) {
  const userId = req.session.userId;
  const [user, progress, stats, recent] = await Promise.all([
    User.findById(userId),
    Game.progressForUser(userId),
    Drill.statsForUser(userId),
    Game.listForUser(userId, 5),
  ]);
  const setup = setupSteps({
    connected: User.usernamesOf(user).length > 0,
    games: progress.games,
    analyzed: progress.analyzed,
    attempts: stats.attempts,
    botGames: progress.bot_games,
  });

  let weakSpot = null;
  if (setup.done) {
    const [moves, games, drills] = await Promise.all([
      Insights.yourMoves(userId),
      Insights.analyzedGames(userId),
      Insights.drillsWithContext(userId),
    ]);
    weakSpot = buildInsights({ moves, games, drills }).spots[0] || null;
  }

  res.render("today", {
    userId,
    setup,
    stats,
    unanalyzed: progress.unanalyzed,
    weakSpot,
    recent: recent.map((g) => ({
      ...g,
      outcome: outcomeFor(g.result, g.user_color),
      opponent: g.user_color === "b" ? g.white_player : g.black_player,
    })),
  });
}

module.exports = { show };
