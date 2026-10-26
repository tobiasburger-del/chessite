// Whole-game analysis shared by the game page and the Train page's
// "Analyze all" queue: evaluate every position, label every move, save.
import { Chess } from "/vendor/chess.js/chess.js";
import { createBatchEngine, GAME_ANALYSIS_DEPTH } from "./analysis.js";

const { classifyGame } = globalThis.MoveClassifier;
const { commentFor } = globalThis.Explain;

// history: chess.js verbose moves. onProgress(done, total) per position.
// Resolves the payload POST /games/:id/analysis expects.
export async function analyzeGame(history, onProgress = () => {}) {
  const fens = [];
  const walk = new Chess();
  fens.push(walk.fen());
  for (const m of history) {
    walk.move({ from: m.from, to: m.to, promotion: m.promotion });
    fens.push(walk.fen());
  }

  const batch = createBatchEngine();
  const positions = [];
  try {
    onProgress(0, fens.length);
    for (const fen of fens) {
      positions.push(await evaluate(batch, fen));
      onProgress(positions.length, fens.length);
    }
  } finally {
    batch.terminate();
  }

  const played = history.map((m) => m.from + m.to + (m.promotion || ""));
  const labels = classifyGame(
    positions.map((p) => ({ score: p.score, best: p.bestUci })),
    played,
  );
  return {
    depth: GAME_ANALYSIS_DEPTH,
    startEvalCp: positions[0].score.cp ?? null,
    moves: history.map((_, i) => ({
      fenAfter: fens[i + 1],
      evalCp: positions[i + 1].score.cp ?? null,
      evalMate: positions[i + 1].score.mate ?? null,
      bestMove: positions[i].bestUci,
      bestSan: positions[i].bestSan,
      classification: labels[i],
      // One line on why the move was weaker and what was better (null for best).
      comment: commentFor(Chess, {
        fen: fens[i],
        played: played[i],
        bestMove: positions[i].bestUci,
        bestLine: positions[i].line,
        playedLine: positions[i + 1].line,
        scoreBefore: positions[i].score,
        scoreAfter: positions[i + 1].score,
        classification: labels[i],
      }),
    })),
  };
}

// Resolves the server's reply ({ ok, drills }) or null on failure.
export async function saveAnalysis(gameId, payload) {
  const res = await fetch(`/games/${gameId}/analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.ok ? res.json() : null;
}

// Parses a stored PGN into chess.js verbose moves.
export function historyFromPgn(pgn) {
  const parsed = new Chess();
  parsed.loadPgn(pgn);
  return parsed.history({ verbose: true });
}

// Game-over positions are scored directly; Stockfish has no move to search.
async function evaluate(batch, fen) {
  const pos = new Chess(fen);
  if (pos.isCheckmate()) {
    return { score: { mate: pos.turn() === "w" ? -1 : 1 }, bestUci: null, bestSan: null, line: [] };
  }
  if (pos.isGameOver()) return { score: { cp: 0 }, bestUci: null, bestSan: null, line: [] };

  const { score, best, line } = await batch.analyze(fen);
  if (!best) return { score, bestUci: null, bestSan: null, line };
  const bestSan = pos.move({ from: best.from, to: best.to, promotion: best.promotion || undefined }).san;
  return { score, bestUci: best.from + best.to + (best.promotion || ""), bestSan, line };
}

export function formatScore(score) {
  if (score.mate != null) return `${score.mate >= 0 ? "+" : "−"}M${Math.abs(score.mate)}`;
  return (score.cp >= 0 ? "+" : "−") + Math.abs(score.cp / 100).toFixed(2);
}
