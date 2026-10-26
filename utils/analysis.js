// Server-side helpers for engine analysis sent from the browser.

const LABELS = ["best", "good", "inaccuracy", "mistake", "blunder"];
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const FEN = /^[pnbrqkPNBRQK1-8/]+ [wb] [KQkq-]+ [a-h1-8-]+ \d+ \d+$/;

const intOrNull = (v) => (Number.isInteger(v) ? v : null);

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
    moves.push({
      fenAfter: m.fenAfter,
      evalCp: intOrNull(m.evalCp),
      evalMate: intOrNull(m.evalMate),
      bestMove: m.bestMove ?? null,
      bestSan: m.bestSan ?? null,
      classification: m.classification,
    });
  }
  return { depth, startEvalCp: intOrNull(body.startEvalCp), moves };
}

// Counts inaccuracies / mistakes / blunders per side for the game page.
function summarize(moves) {
  const empty = () => ({ inaccuracy: 0, mistake: 0, blunder: 0 });
  const counts = { w: empty(), b: empty() };
  for (const m of moves) {
    if (counts[m.color] && m.classification in counts[m.color]) {
      counts[m.color][m.classification]++;
    }
  }
  return counts;
}

module.exports = { LABELS, parseAnalysis, summarize };
