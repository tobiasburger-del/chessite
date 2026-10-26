const Insights = require("../models/insights");
const Drill = require("../models/drill");
const Game = require("../models/game");
const { buildInsights } = require("../utils/insights");

async function show(req, res) {
  const userId = req.session.userId;
  // Drills made before tagging existed get their tags on first visit.
  if (await Insights.hasUntaggedDrills(userId)) await Drill.tagForUser(userId);

  const [moves, games, drills, unanalyzed] = await Promise.all([
    Insights.yourMoves(userId),
    Insights.analyzedGames(userId),
    Insights.drillsWithContext(userId),
    Game.listUnanalyzedForUser(userId),
  ]);
  res.render("insights", {
    userId,
    insights: buildInsights({ moves, games, drills }),
    unanalyzedCount: unanalyzed.length,
  });
}

module.exports = { show };
