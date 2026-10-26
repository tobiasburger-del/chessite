const Game = require("../models/game");
const User = require("../models/user");
const Drill = require("../models/drill");
const { isValidUsername } = require("../utils/usernames");
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
// Connecting an account imports this many of your latest games; later
// imports fetch everything new since then, up to MAX_NEW per click.
const FIRST_IMPORT = 50;
const MAX_NEW = 100;

async function renderImport(res, userId, { status = 200, error = null, pgnOpen = false } = {}) {
  const [user, counts] = await Promise.all([
    User.findById(userId),
    Game.countBySourceForUser(userId),
  ]);
  const accounts = Object.entries(SOURCES).map(([source, s]) => ({
    source,
    label: s.label,
    name: user[s.field],
    games: counts[source],
  }));
  res.status(status).render("import", { userId, accounts, error, pgnOpen });
}

async function importForm(req, res) {
  await renderImport(res, req.session.userId);
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
  const fail = (error) => renderImport(res, userId, { status: 400, error, pgnOpen: true });

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

// POST { source, username? }: with a username, connect that account and import
// your latest games; without, import what's new on the connected account.
async function importOnline(req, res) {
  const userId = req.session.userId;
  const user = await User.findById(userId);
  const source = SOURCES[req.body.source];
  const fail = (error) => renderImport(res, userId, { status: 400, error });
  if (!source) return fail("Pick Lichess or Chess.com.");

  const typed = (req.body.username || "").trim();
  if (typed && !isValidUsername(typed)) {
    return fail(`${source.label} usernames only contain letters, numbers, _ and -.`);
  }
  const username = typed || user[source.field];
  if (!username) return fail(`Enter your ${source.label} username.`);

  const known = await Game.sourceUrlsForUser(userId);
  let pgns;
  try {
    pgns = await source.fetch(username, {
      max: typed ? FIRST_IMPORT : MAX_NEW,
      isKnown: (url) => known.has(url),
    });
  } catch (err) {
    if (err instanceof OnlineImportError) return fail(`${source.label}: ${err.message}`);
    throw err;
  }

  // Only save the username once the site confirmed it exists.
  if (typed) {
    await User.setUsername(userId, source.field, typed);
    user[source.field] = typed;
    // Games you imported earlier now learn which side you played.
    await Game.recomputeUserColors(userId, User.usernamesOf(user));
  }
  // Store oldest first so same-day games list newest on top.
  const counts = await storeGames(userId, User.usernamesOf(user), pgns.reverse());
  if (typed) await Drill.syncForUser(userId);
  res.redirect(summaryUrl(counts));
}

module.exports = { importForm, importPgn, importOnline };
