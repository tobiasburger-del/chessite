// Server-side helpers for engine analysis sent from the browser.
const { winChance } = require("../public/js/moveClassifier");

const LABELS = ["best", "good", "inaccuracy", "mistake", "blunder"];
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const FEN = /^[pnbrqkPNBRQK1-8/]+ [wb] [KQkq-]+ [a-h1-8-]+ \d+ \d+$/;

const intOrNull = (v) => (Number.isInteger(v) ? v : null);
const MAX_COMMENT = 200;

// Validates the POST body against the game's move count. Returns the cleaned
// payload, or null if anything is off.
function parseAnalysis(body, moveCount) {
  if (!body || !Array.isArray(body.moves)) return null;
  const depth = body.depth;
  if (!Number.isInteger(depth) || depth < 1 || depth > 40) return null;
  if (body.moves.length !== moveCount) return null;

  const moves = [];
  for (const m of body.moves) {
    if (!m || !LABELS.includes(m.classification)) return null;
    if (typeof m.fenAfter !== "string" || !FEN.test(m.fenAfter)) return null;
    if (m.bestMove != null && !UCI.test(m.bestMove)) return null;
    if (m.bestSan != null && (typeof m.bestSan !== "string" || m.bestSan.length > 10)) return null;
    if (m.comment != null && typeof m.comment !== "string") return null;
    moves.push({
      fenAfter: m.fenAfter,
      evalCp: intOrNull(m.evalCp),
      evalMate: intOrNull(m.evalMate),
      bestMove: m.bestMove ?? null,
      bestSan: m.bestSan ?? null,
      classification: m.classification,
      // Trimmed rather than rejected: a long comment shouldn't lose the analysis.
      comment: m.comment ? m.comment.slice(0, MAX_COMMENT) : null,
    });
  }
  return { depth, startEvalCp: intOrNull(body.startEvalCp), moves };
}

// White-POV score of a `move` row (after the move), or null if unanalyzed.
function moveScore(row) {
  if (row.eval_mate != null) return { mate: row.eval_mate };
  if (row.eval_cp != null) return { cp: row.eval_cp };
  return null;
}

// Counts inaccuracies / mistakes / blunders per side for the game page.
// Moves before startPly (replayed in a bot game) don't count.
function summarize(moves, startPly = 0) {
  const empty = () => ({ inaccuracy: 0, mistake: 0, blunder: 0 });
  const counts = { w: empty(), b: empty() };
  moves.forEach((m, i) => {
    if (i < startPly) return;
    if (counts[m.color] && m.classification in counts[m.color]) {
      counts[m.color][m.classification]++;
    }
  });
  return counts;
}

// Accuracy per side, 0–100: Lichess's per-move formula on the mover's win-%
// loss, averaged over that side's moves. Null for a side with no scored moves.
function accuracy(moves, startScore, startPly = 0) {
  const per = { w: [], b: [] };
  let before = startScore;
  moves.forEach((m, i) => {
    const after = moveScore(m);
    if (i >= startPly && before && after && per[m.color]) {
      const sign = m.color === "w" ? 1 : -1;
      const drop = Math.max(0, sign * (winChance(before) - winChance(after)));
      const acc = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
      per[m.color].push(Math.min(100, Math.max(0, acc)));
    }
    before = after;
  });
  const mean = (xs) =>
    xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
  return { w: mean(per.w), b: mean(per.b) };
}

module.exports = { LABELS, parseAnalysis, moveScore, summarize, accuracy };
