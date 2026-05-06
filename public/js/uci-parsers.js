// Pure UCI line parsers. Loaded as a classic script in the browser (exposes
// globalThis.UciParsers) and as a CommonJS module in Jest (module.exports).
// Kept separate from analysis.js so Jest can require() it without an ESM
// transform — analysis.js itself is a browser ESM module and uses Worker.

(function (root) {
  function parseInfoLine(line) {
    if (typeof line !== "string" || !line.startsWith("info ")) return null;
    const tokens = line.trim().split(/\s+/);
    let depth = null;
    let scoreCp = null;
    let scoreMate = null;
    let pv = null;

    for (let i = 1; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === "depth" && i + 1 < tokens.length) {
        depth = Number(tokens[++i]);
      } else if (t === "score" && i + 2 < tokens.length) {
        const kind = tokens[++i];
        const val = Number(tokens[++i]);
        if (kind === "cp") scoreCp = val;
        else if (kind === "mate") scoreMate = val;
      } else if (t === "pv") {
        pv = tokens.slice(i + 1);
        break;
      }
    }

    if (depth == null) return null;
    if (scoreCp == null && scoreMate == null) return null;

    const score = scoreCp != null ? { cp: scoreCp } : { mate: scoreMate };
    return { depth, score, pv };
  }

  function parseBestmove(line) {
    if (typeof line !== "string" || !line.startsWith("bestmove")) return null;
    const tokens = line.trim().split(/\s+/);
    const move = tokens[1];
    if (!move || move === "(none)" || move === "0000") return null;
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) return null;
    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const promotion = move.length === 5 ? move[4] : null;
    return { from, to, promotion };
  }

  function fenSideToMove(fen) {
    if (typeof fen !== "string") return "w";
    const parts = fen.trim().split(/\s+/);
    return parts[1] === "b" ? "b" : "w";
  }

  function toWhitePov(score, sideToMove) {
    if (!score) return null;
    if (sideToMove !== "b") return score;
    if ("cp" in score) return { cp: -score.cp };
    if ("mate" in score) return { mate: -score.mate };
    return score;
  }

  const api = { parseInfoLine, parseBestmove, fenSideToMove, toWhitePov };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.UciParsers = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
