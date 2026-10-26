// What the Train page shows before you move: the opponent's last move, the
// move you played in the game, and a first hint about the idea.
const { Chess } = require("chess.js");

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// SAN played from a FEN → { from, to }, or null if it can't be replayed.
function squaresOf(fen, san) {
  if (!fen || !san) return null;
  try {
    const move = new Chess(fen).move(san);
    return { from: move.from, to: move.to };
  } catch {
    return null;
  }
}

// One hint per tag, most telling first.
const TAG_HINTS = [
  ["missed-mate", "You have a forced mate here."],
  ["missed-capture", "There's material to win."],
  ["allowed-mate", "Watch your king. Your game move allowed mate."],
  ["hung-piece", "Your game move left a piece loose. Keep everything protected."],
];

// evalBefore: White's point of view, { cp } or { mate }; color: your side.
function ideaHint({ tags, evalBefore, color }) {
  for (const [tag, text] of TAG_HINTS) {
    if ((tags || []).includes(tag)) return text;
  }
  const cp = evalBefore && evalBefore.cp != null ? (color === "w" ? 1 : -1) * evalBefore.cp : null;
  if (cp == null) return "Look at every check, capture and threat first.";
  if (cp >= 100) return `You were better here (+${(cp / 100).toFixed(1)}). Find the move that keeps it.`;
  if (cp <= -100) return "You were already worse here. Find the move that limits the damage.";
  return "The position is about equal. Find the move that keeps it that way.";
}

// prevSan: the opponent's move that led to the drill position; prevFenBefore:
// the position before it (null when it was the first move of the game).
function drillView({ fen, playedSan, prevSan, prevFenBefore, tags, evalBefore, color }) {
  return {
    sideToMove: fen.split(" ")[1] === "w" ? "White" : "Black",
    lastMove: prevSan ? squaresOf(prevFenBefore || START_FEN, prevSan) : null,
    playedMove: squaresOf(fen, playedSan),
    ideaHint: ideaHint({ tags, evalBefore, color }),
  };
}

module.exports = { drillView, squaresOf, ideaHint };
