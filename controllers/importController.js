const Game = require("../models/game");
const User = require("../models/user");
const {
  first,
  splitPgns,
  detectUserColor,
  sourceUrl,
  openingName,
} = require("../utils/pgn-parser");
const {
  fetchLichessPgns,
  fetchChessComPgns,
  OnlineImportError,
} = require("../utils/onlineGames");

const SOURCES = {
  lichess: { label: "Lichess", field: "lichess_username", fetch: fetchLichessPgns },
  chesscom: { label: "Chess.com", field: "chesscom_username", fetch: fetchChessComPgns },
};
const COUNTS = [10, 25, 50];

async function importForm(req, res) {
  const user = await User.findById(req.session.userId);
  res.render("import", { userId: req.session.userId, user, error: null });
}

// Parses and stores each PGN, skipping games already in the library.
async function storeGames(userId, usernames, pgns) {
  const counts = { imported: 0, skipped: 0, failed: 0, lastId: null };
  for (const pgn of pgns) {
    let parsed;
    try {
      parsed = first(pgn);
    } catch (err) {
      counts.failed++;
      continue;
    }
    const url = sourceUrl(parsed.header);
    if (await Game.existsForUser(pgn, url, userId)) {
      counts.skipped++;
      continue;
    }
    counts.lastId = await Game.create(userId, pgn, parsed.header, parsed.history, {
      userColor: detectUserColor(parsed.header, usernames),
      sourceUrl: url,
      opening: openingName(parsed.header),
    });
    counts.imported++;
  }
  return counts;
}

function summaryUrl({ imported, skipped, failed }) {
  return `/games?imported=${imported}&skipped=${skipped}&failed=${failed}`;
}

async function importPgn(req, res) {
  const userId = req.session.userId;
  const user = await User.findById(userId);
  const fail = (error) =>
    res.status(400).render("import", { userId, user, error });

  const pgns = splitPgns(req.body.pgn);
  if (pgns.length === 0) return fail("Paste a PGN first.");

  const counts = await storeGames(userId, User.usernamesOf(user), pgns);
  if (pgns.length === 1) {
    if (counts.failed) return fail("That PGN could not be read. Check that it is complete.");
    if (counts.skipped) return fail("You already imported this game.");
    return res.redirect("/games/" + counts.lastId);
  }
  res.redirect(summaryUrl(counts));
}

async function importOnline(req, res) {
  const userId = req.session.userId;
  const user = await User.findById(userId);
  const source = SOURCES[req.body.source];
  const max = COUNTS.includes(Number(req.body.max)) ? Number(req.body.max) : COUNTS[0];
  const fail = (error) =>
    res.status(400).render("import", { userId, user, error });

  if (!source) return fail("Pick Lichess or Chess.com.");
  const username = user[source.field];
  if (!username) return fail(`Add your ${source.label} username in Settings first.`);

  let pgns;
  try {
    pgns = await source.fetch(username, max);
  } catch (err) {
    if (err instanceof OnlineImportError) return fail(`${source.label}: ${err.message}`);
    throw err;
  }
  // Store oldest first so same-day games list newest on top.
  const counts = await storeGames(userId, User.usernamesOf(user), pgns.reverse());
  res.redirect(summaryUrl(counts));
}

module.exports = { importForm, importPgn, importOnline, COUNTS };
