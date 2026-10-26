const Game = require("../models/game");
const Drill = require("../models/drill");
const { outcomeFor } = require("../utils/pgn-parser");
const { summarize, accuracy } = require("../utils/analysis");

// Adds the fields the list shows from your point of view.
function fromYourSide(game) {
  const youAreWhite = game.user_color === "w";
  return {
    ...game,
    outcome: outcomeFor(game.result, game.user_color),
    opponent: game.user_color
      ? youAreWhite ? game.black_player : game.white_player
      : null,
    opponentElo: game.user_color
      ? youAreWhite ? game.black_elo : game.white_elo
      : null,
  };
}

async function list(req, res) {
  const games = (await Game.listForUser(req.session.userId)).map(fromYourSide);
  // Set after a bulk import: /games?imported=3&skipped=1&failed=0
  const summary =
    req.query.imported !== undefined
      ? {
          imported: Number(req.query.imported) || 0,
          skipped: Number(req.query.skipped) || 0,
          failed: Number(req.query.failed) || 0,
        }
      : null;
  res.render("games", { games, summary, userId: req.session.userId });
}

// Error counts and accuracy per side, your side first when we know it.
function summaryRows(game, moves) {
  const startScore = game.start_eval_cp != null ? { cp: game.start_eval_cp } : null;
  const counts = summarize(moves, game.start_ply);
  const acc = accuracy(moves, startScore, game.start_ply);
  const sides = game.user_color === "b" ? ["b", "w"] : ["w", "b"];
  return sides.map((color) => ({
    label:
      (game.user_color === color ? "You · " : "") +
      (color === "w" ? "White" : "Black"),
    isYou: game.user_color === color,
    counts: counts[color],
    accuracy: acc[color],
  }));
}

async function show(req, res) {
  const userId = req.session.userId;
  const game = await Game.findForUser(req.params.id, userId);
  let moves = [];
  if (game) {
    const [rows, drills] = await Promise.all([
      Game.listMoves(game.id),
      Drill.idsByMoveForGame(game.id, userId),
    ]);
    moves = rows.map((m, i) => ({
      ...m,
      drillId: drills.get(m.id) || null,
      isMine: m.color === game.user_color,
      isReplayed: i < game.start_ply,
    }));
  }
  res.status(game ? 200 : 404).render("game-detail", {
    game,
    moves,
    summary: game && game.analyzed_at ? summaryRows(game, moves) : null,
    userId,
  });
}

async function remove(req, res) {
  await Game.removeForUser(req.params.id, req.session.userId);
  res.redirect("/games");
}

async function updateNotes(req, res) {
  await Game.updateNotesForUser(
    req.params.id,
    req.session.userId,
    req.body.notes,
  );
  res.redirect("/games/" + req.params.id);
}

async function setSide(req, res) {
  const color = ["w", "b"].includes(req.body.color) ? req.body.color : null;
  await Game.setUserColorForUser(req.params.id, req.session.userId, color);
  await Drill.syncForUser(req.session.userId, Number(req.params.id) || null);
  res.redirect("/games/" + req.params.id);
}

module.exports = { list, show, remove, updateNotes, setSide };
