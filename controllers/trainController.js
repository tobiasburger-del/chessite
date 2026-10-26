const Drill = require("../models/drill");
const Game = require("../models/game");
const { nextReview } = require("../utils/srs");

// Shapes a drill row for the view: who you played, which move, evals.
function present(drill) {
  const youAreWhite = drill.user_color === "w";
  const score = (cp, mate) =>
    mate != null ? { mate } : cp != null ? { cp } : null;
  return {
    id: drill.id,
    gameId: drill.game_id,
    fen: drill.fen,
    color: drill.user_color,
    bestMove: drill.best_move,
    bestSan: drill.best_san,
    playedSan: drill.played_san,
    classification: drill.classification,
    moveLabel: drill.move_number + (youAreWhite ? "." : "…"),
    // Ply of the mistaken move, for the "open game" link.
    ply: (drill.move_number - 1) * 2 + (youAreWhite ? 1 : 2),
    opponent: youAreWhite ? drill.black_player : drill.white_player,
    datePlayed: drill.date_played,
    opening: drill.opening,
    evalBefore: score(drill.eval_before_cp, drill.eval_before_mate),
    evalAfter: score(drill.eval_after_cp, drill.eval_after_mate),
    isRepeat: drill.attempts > 0,
  };
}

// "in 3 hours" / "tomorrow" / "in 6 days" for the all-caught-up message.
function untilText(date) {
  if (!date) return null;
  const hours = Math.max(1, Math.round((new Date(date) - Date.now()) / 3600000));
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

async function show(req, res) {
  const userId = req.session.userId;
  const [drill, stats, unanalyzed] = await Promise.all([
    Drill.nextDueForUser(userId),
    Drill.statsForUser(userId),
    Game.listUnanalyzedForUser(userId),
  ]);
  res.render("train", {
    userId,
    drill: drill ? present(drill) : null,
    stats,
    nextDue: untilText(stats.next_due),
    unanalyzedCount: unanalyzed.length,
  });
}

// Games for the "Analyze all" queue, run in the browser one by one.
async function queue(req, res) {
  const games = await Game.listUnanalyzedForUser(req.session.userId);
  res.json(games.map((g) => ({ id: g.id, pgn: g.pgn_raw })));
}

async function result(req, res) {
  const userId = req.session.userId;
  const drill = await Drill.findForUser(req.params.id, userId);
  if (!drill) return res.status(404).json({ error: "Drill not found" });
  if (typeof req.body.correct !== "boolean") {
    return res.status(400).json({ error: "correct must be true or false" });
  }

  const review = nextReview(drill.box, req.body.correct);
  await Drill.recordResultForUser(drill.id, userId, req.body.correct, review);
  res.json({ ok: true, box: review.box, dueAt: review.dueAt });
}

module.exports = { show, queue, result };
