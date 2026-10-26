const chess = require("chess.js");

// this function parses the pgn chess game string and extracts the metadata and move history into a structured JS object
function first(PGN_string) {
  const chessInstance = new chess.Chess();
  chessInstance.loadPgn(PGN_string);
  return { header: chessInstance.header(), history: chessInstance.history() };
}

// Splits a multi-game export (Lichess / Chess.com) into one PGN string per game.
function splitPgns(text) {
  return (text || "")
    .split(/\n\s*\n(?=\[Event )/)
    .map((pgn) => pgn.trim())
    .filter(Boolean);
}

// Returns "w" or "b" for the side one of the usernames played, else null.
function detectUserColor(header, usernames) {
  const names = usernames.filter(Boolean).map((u) => u.toLowerCase());
  if ((header.White || "") && names.includes(header.White.toLowerCase())) return "w";
  if ((header.Black || "") && names.includes(header.Black.toLowerCase())) return "b";
  return null;
}

// Stable link back to the original game, used to skip re-imports.
function sourceUrl(header) {
  if (header.Link) return header.Link;
  if (/^https?:\/\//.test(header.Site || "")) return header.Site;
  return null;
}

// Lichess sends an Opening header; Chess.com only an ECOUrl.
function openingName(header) {
  if (header.Opening) return header.Opening;
  if (header.ECOUrl) {
    const slug = header.ECOUrl.split("/openings/")[1];
    // Drop the trailing move list: "...-Variation-3.d4-Bg7" / "...Line...5.Bg2"
    const name = slug && slug.split(/\.\.\.|-\d/)[0];
    if (name) return name.replace(/-/g, " ");
  }
  return null;
}

// "win" / "loss" / "draw" from your side, or null if unknown.
function outcomeFor(result, userColor) {
  if (!userColor) return null;
  if (result === "1/2-1/2") return "draw";
  if (result === "1-0") return userColor === "w" ? "win" : "loss";
  if (result === "0-1") return userColor === "b" ? "win" : "loss";
  return null;
}

module.exports = {
  first,
  splitPgns,
  detectUserColor,
  sourceUrl,
  openingName,
  outcomeFor,
};
