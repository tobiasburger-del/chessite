// Labels each move (best / good / inaccuracy / mistake / blunder) from how
// much it lowered the mover's winning chances. Same idea and thresholds as
// Lichess. Loaded as a classic script in the browser (globalThis.MoveClassifier)
// and as a CommonJS module in Jest, like uci-parsers.js.

(function (root) {
  // Win-% points the mover may lose before a move gets each label.
  const THRESHOLDS = { inaccuracy: 10, mistake: 20, blunder: 30 };

  // Score is White's point of view: { cp } or { mate }. Returns 0..100.
  function winChance(score) {
    if (score.mate != null) return score.mate > 0 ? 100 : 0;
    const cp = Math.max(-1000, Math.min(1000, score.cp));
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  }

  // before/after: White-POV scores around the move; played/best: UCI moves.
  function classifyMove({ before, after, mover, played, best }) {
    if (best && played === best) return "best";
    const sign = mover === "w" ? 1 : -1;
    const drop = sign * (winChance(before) - winChance(after));
    if (drop >= THRESHOLDS.blunder) return "blunder";
    if (drop >= THRESHOLDS.mistake) return "mistake";
    if (drop >= THRESHOLDS.inaccuracy) return "inaccuracy";
    return "good";
  }

  // positions[i]: { score, best } for the position before ply i+1 (so there
  // is one more position than moves). played[i]: UCI of ply i+1.
  function classifyGame(positions, played) {
    return played.map((uci, i) =>
      classifyMove({
        before: positions[i].score,
        after: positions[i + 1].score,
        mover: i % 2 === 0 ? "w" : "b",
        played: uci,
        best: positions[i].best,
      }),
    );
  }

  const api = { THRESHOLDS, winChance, classifyMove, classifyGame };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.MoveClassifier = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
