const Game = require("../models/game");
const { outcomeFor } = require("../utils/pgn-parser");

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

async function show(req, res) {
  const game = await Game.findForUser(req.params.id, req.session.userId);
  const moves = game ? await Game.listMoves(game.id) : [];
  res.status(game ? 200 : 404).render("game-detail", {
    game,
    moves,
    userId: req.session.userId,
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
  res.redirect("/games/" + req.params.id);
}

module.exports = { list, show, remove, updateNotes, setSide };
