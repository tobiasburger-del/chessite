// Fetches a user's most recent standard-chess games from the public Lichess
// and Chess.com APIs. Both return an array of PGN strings, newest first.
const { splitPgns } = require("./pgn-parser");

// Lichess rejects some default user agents (e.g. curl's) with a 404 page.
const HEADERS = { "User-Agent": "ChessCompanion/1.0 (personal training app)" };
const TIMEOUT_MS = 20000;

class OnlineImportError extends Error {}

async function get(url, accept) {
  let res;
  try {
    res = await fetch(url, {
      headers: { ...HEADERS, Accept: accept },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new OnlineImportError("Could not reach the site. Try again in a moment.");
  }
  if (res.status === 404) throw new OnlineImportError("That username was not found.");
  if (res.status === 429) throw new OnlineImportError("Rate limited. Wait a minute and try again.");
  if (!res.ok) throw new OnlineImportError(`The site answered with an error (${res.status}).`);
  return res;
}

async function fetchLichessPgns(username, max) {
  const params = new URLSearchParams({
    max: String(max),
    opening: "true",
    clocks: "false",
    evals: "false",
    perfType: "ultraBullet,bullet,blitz,rapid,classical,correspondence",
  });
  const res = await get(
    `https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params}`,
    "application/x-chess-pgn",
  );
  return splitPgns(await res.text());
}

// Chess.com groups games into monthly archives (oldest game first in each),
// so walk the months newest-first until we have enough.
async function fetchChessComPgns(username, max) {
  const base = `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}`;
  const { archives } = await (await get(`${base}/games/archives`, "application/json")).json();
  const pgns = [];
  for (const monthUrl of [...archives].reverse()) {
    const { games } = await (await get(monthUrl, "application/json")).json();
    for (const game of [...games].reverse()) {
      if (game.rules === "chess" && game.pgn) pgns.push(game.pgn);
      if (pgns.length >= max) return pgns;
    }
  }
  return pgns;
}

module.exports = { fetchLichessPgns, fetchChessComPgns, OnlineImportError };
