// Fetches a user's most recent standard-chess games from the public Lichess
// and Chess.com APIs. Both return an array of PGN strings, newest first,
// stopping early at a game you already have (`isKnown(url)`).
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

// The game's page on Lichess / Chess.com, read straight from the PGN headers.
function pgnSourceUrl(pgn) {
  const link = /^\[Link "([^"]+)"\]/m.exec(pgn);
  if (link) return link[1];
  const site = /^\[Site "(https?:\/\/[^"]+)"\]/m.exec(pgn);
  return site ? site[1] : null;
}

// Newest-first PGNs up to the first one already in the library.
function newestUnknown(pgns, isKnown) {
  const end = pgns.findIndex((pgn) => {
    const url = pgnSourceUrl(pgn);
    return url !== null && isKnown(url);
  });
  return end === -1 ? pgns : pgns.slice(0, end);
}

async function fetchLichessPgns(username, { max, isKnown = () => false }) {
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
  return newestUnknown(splitPgns(await res.text()), isKnown);
}

// Chess.com groups games into monthly archives (oldest game first in each),
// so walk the months newest-first until we have enough.
async function fetchChessComPgns(username, { max, isKnown = () => false }) {
  const base = `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}`;
  const { archives } = await (await get(`${base}/games/archives`, "application/json")).json();
  const pgns = [];
  for (const monthUrl of [...archives].reverse()) {
    const { games } = await (await get(monthUrl, "application/json")).json();
    for (const game of [...games].reverse()) {
      if (game.rules !== "chess" || !game.pgn) continue;
      if (isKnown(pgnSourceUrl(game.pgn))) return pgns;
      pgns.push(game.pgn);
      if (pgns.length >= max) return pgns;
    }
  }
  return pgns;
}

module.exports = {
  fetchLichessPgns,
  fetchChessComPgns,
  pgnSourceUrl,
  newestUnknown,
  OnlineImportError,
};
