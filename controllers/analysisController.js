const Game = require("../models/game");
const { parseAnalysis } = require("../utils/analysis");

// The browser runs Stockfish and posts the per-move results here.
async function save(req, res) {
  const userId = req.session.userId;
  const game = await Game.findForUser(req.params.id, userId);
  if (!game) return res.status(404).json({ error: "Game not found" });

  const moves = await Game.listMoves(game.id);
  const analysis = parseAnalysis(req.body, moves.length);
  if (!analysis) return res.status(400).json({ error: "Invalid analysis" });

  await Game.saveAnalysisForUser(game.id, userId, analysis);
  res.json({ ok: true });
}

module.exports = { save };
