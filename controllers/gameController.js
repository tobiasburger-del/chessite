const Game = require("../models/game");
const { first } = require("../utils/pgn-parser");

async function list(req, res) {
  const games = await Game.listForUser(req.session.userId);
  res.render("games", { games, userId: req.session.userId });
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

function importForm(req, res) {
  res.render("import", { userId: req.session.userId, error: null });
}

async function create(req, res) {
  const userId = req.session.userId;
  const pgn = (req.body.pgn || "").trim();
  const fail = (error) =>
    res.status(400).render("import", { userId, error });

  if (!pgn) return fail("Paste a PGN first.");

  let parsed;
  try {
    parsed = first(pgn);
  } catch (err) {
    return fail("That PGN could not be read. Check that it is complete.");
  }
  if (await Game.existsForUser(pgn, userId)) {
    return fail("You already imported this game.");
  }

  const gameId = await Game.create(userId, pgn, parsed.header, parsed.history);
  res.redirect("/games/" + gameId);
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

module.exports = { list, show, importForm, create, remove, updateNotes };
