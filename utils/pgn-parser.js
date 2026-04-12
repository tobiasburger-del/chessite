const chess = require("chess.js");

// this function parses the pgn chess game string and extracts the metadata and move history into a structured JS object
function first(PGN_string) {
  const chessInstance = new chess.Chess();
  chessInstance.loadPgn(PGN_string);
  return { header: chessInstance.header(), history: chessInstance.history() };
}

module.exports = { first };
