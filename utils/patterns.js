// Simple, explainable patterns behind a mistake: which phase it happened in,
// and whether it was about mates or loose pieces. Works on FEN strings only.

const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// Below this much non-pawn material (both sides, start = 62) it's an endgame.
const ENDGAME_MATERIAL = 26;
const OPENING_LAST_MOVE = 12;

// "e4" → the piece letter on that square ("P", "n", ...) or null.
function pieceAt(fen, square) {
  const rows = fen.split(" ")[0].split("/");
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  let col = 0;
  for (const ch of rows[8 - rank]) {
    if (/\d/.test(ch)) {
      col += Number(ch);
    } else {
      if (col === file) return ch;
      col++;
    }
    if (col > file) return null;
  }
  return null;
}

function nonPawnMaterial(fen) {
  let total = 0;
  for (const ch of fen.split(" ")[0]) {
    const v = VALUES[ch.toLowerCase()];
    if (v && ch.toLowerCase() !== "p") total += v;
  }
  return total;
}

function phaseOf(fen, moveNumber) {
  if (nonPawnMaterial(fen) <= ENDGAME_MATERIAL) return "endgame";
  return moveNumber <= OPENING_LAST_MOVE ? "opening" : "middlegame";
}

const isWhite = (piece) => piece === piece.toUpperCase();

// A knight, bishop, rook or queen belonging to `color` on that square.
function pieceOf(fen, square, color) {
  const p = fen && square && pieceAt(fen, square);
  if (!p || VALUES[p.toLowerCase()] < 3) return false;
  return (color === "w") === isWhite(p);
}

// color: your side. fen/fenAfter: before/after your move. bestMove: the engine
// move you missed. nextBestMove: the opponent's best reply to your move.
// Evals are White's point of view.
function tagsFor({ color, fen, fenAfter, bestMove, nextBestMove, evalBefore, evalAfter }) {
  const sign = color === "w" ? 1 : -1;
  const youMate = (s) => s && s.mate != null && sign * s.mate > 0;
  const theyMate = (s) => s && s.mate != null && sign * s.mate < 0;
  const opponent = color === "w" ? "b" : "w";
  const tags = [];

  if (youMate(evalBefore) && !youMate(evalAfter)) tags.push("missed-mate");
  if (evalAfter && !theyMate(evalBefore) && theyMate(evalAfter)) tags.push("allowed-mate");
  if (nextBestMove && pieceOf(fenAfter, nextBestMove.slice(2, 4), color)) tags.push("hung-piece");
  if (bestMove && pieceOf(fen, bestMove.slice(2, 4), opponent)) tags.push("missed-capture");
  return tags;
}

// "French Defense: Advance Variation" → "French Defense";
// "English Opening Four Knights ..." → "English Opening".
function openingFamily(name) {
  if (!name) return null;
  const beforeColon = name.split(":")[0].trim();
  if (beforeColon !== name.trim()) return beforeColon;
  const m = name.match(/^(.*?\b(Opening|Defense|Defence|Gambit|Game|Attack|System))\b/);
  if (m) return m[1];
  return name.split(/\s+/).slice(0, 2).join(" ") || null;
}

module.exports = { pieceAt, nonPawnMaterial, phaseOf, tagsFor, openingFamily };
