const { parseAnalysis, summarize } = require("../utils/analysis");

const FEN_AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

function payload(overrides = {}) {
  return {
    depth: 12,
    startEvalCp: 20,
    moves: [
      {
        fenAfter: FEN_AFTER_E4,
        evalCp: 30,
        evalMate: null,
        bestMove: "e2e4",
        bestSan: "e4",
        classification: "best",
      },
    ],
    ...overrides,
  };
}

describe("parseAnalysis", () => {
  test("accepts a valid payload", () => {
    const parsed = parseAnalysis(payload(), 1);
    expect(parsed.depth).toBe(12);
    expect(parsed.startEvalCp).toBe(20);
    expect(parsed.moves[0]).toEqual({
      fenAfter: FEN_AFTER_E4,
      evalCp: 30,
      evalMate: null,
      bestMove: "e2e4",
      bestSan: "e4",
      classification: "best",
    });
  });

  test("rejects a move count that does not match the game", () => {
    expect(parseAnalysis(payload(), 2)).toBeNull();
  });

  test("rejects unknown labels", () => {
    const p = payload();
    p.moves[0].classification = "brilliant";
    expect(parseAnalysis(p, 1)).toBeNull();
  });

  test("rejects malformed FEN and UCI", () => {
    const badFen = payload();
    badFen.moves[0].fenAfter = "<script>";
    expect(parseAnalysis(badFen, 1)).toBeNull();

    const badUci = payload();
    badUci.moves[0].bestMove = "e2-e4";
    expect(parseAnalysis(badUci, 1)).toBeNull();
  });

  test("rejects a bad depth", () => {
    expect(parseAnalysis(payload({ depth: "12" }), 1)).toBeNull();
    expect(parseAnalysis(payload({ depth: 0 }), 1)).toBeNull();
  });

  test("allows a missing best move (game-over position)", () => {
    const p = payload();
    p.moves[0].bestMove = null;
    p.moves[0].bestSan = null;
    expect(parseAnalysis(p, 1).moves[0].bestMove).toBeNull();
  });

  test("non-integer evals become null", () => {
    const p = payload();
    p.moves[0].evalCp = "30";
    expect(parseAnalysis(p, 1).moves[0].evalCp).toBeNull();
  });
});

describe("summarize", () => {
  test("counts errors per side", () => {
    expect(
      summarize([
        { color: "w", classification: "blunder" },
        { color: "b", classification: "mistake" },
        { color: "b", classification: "inaccuracy" },
        { color: "w", classification: "best" },
        { color: "w", classification: null },
      ]),
    ).toEqual({
      w: { inaccuracy: 0, mistake: 0, blunder: 1 },
      b: { inaccuracy: 1, mistake: 1, blunder: 0 },
    });
  });
});
