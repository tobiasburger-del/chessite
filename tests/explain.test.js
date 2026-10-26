const { Chess } = require("chess.js");
const { playLine, describeTrade, explainLine, MAX_PLIES } = require("../public/js/explain.js");

// Drill positions from real games.
// White to play Rxe1, winning the queen.
const ROOK_TAKES_QUEEN = "8/8/4R3/8/PP5p/7P/1P1k2PK/4q3 w - - 0 44";
// White mates in 2 starting with Qf7+.
const MATE_IN_2 = "4r1k1/1pp5/p6p/2qpN3/Pn2n3/2P1P3/1P4PP/3R1QK1 w - - 1 25";
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("playLine", () => {
  test("plays UCI moves into SAN with a FEN per ply", () => {
    const plies = playLine(Chess, START, ["e2e4", "e7e5", "g1f3"]);
    expect(plies.map((p) => p.san)).toEqual(["e4", "e5", "Nf3"]);
    expect(plies[2].fen).toMatch(/^rnbqkbnr\/pppp1ppp\/8\/4p3\/4P3\/5N2\//);
  });

  test("stops at an illegal move and caps the length", () => {
    expect(playLine(Chess, START, ["e2e4", "e2e4"]).length).toBe(1);
    const long = ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"];
    expect(playLine(Chess, START, long).length).toBe(MAX_PLIES);
  });
});

describe("describeTrade", () => {
  test("names the biggest net gain, and what it cost", () => {
    expect(describeTrade(["q"], [])).toBe("the queen");
    expect(describeTrade(["q"], ["r"])).toBe("the queen for a rook");
    expect(describeTrade(["n", "p"], ["p"])).toBe("a knight");
    expect(describeTrade(["p"], ["p"])).toBeNull();
  });
});

describe("explainLine", () => {
  test("winning material", () => {
    const { summary } = explainLine(Chess, {
      fen: ROOK_TAKES_QUEEN,
      line: ["e6e1", "d2e1"],
      scoreAfter: { cp: 900 },
    });
    expect(summary).toBe("Rxe1 wins the queen for a rook.");
  });

  test("a forced mate counts the move itself", () => {
    const { summary, plies } = explainLine(Chess, {
      fen: MATE_IN_2,
      line: ["f1f7", "g8h8", "f7e8"],
      scoreAfter: { mate: 1 },
    });
    expect(summary).toBe("Qf7+ forces mate in 2.");
    expect(plies.map((p) => p.san)).toEqual(["Qf7+", "Kh8", "Qxe8+"]);
  });

  test("allowing mate names the reply", () => {
    const { summary } = explainLine(Chess, {
      fen: "6k1/5ppp/8/8/8/8/r4PPP/6K1 w - - 0 1",
      line: ["f2f3", "a2a1"],
      scoreAfter: { mate: -1 },
      kind: "played",
    });
    expect(summary).toBe("f3 allows mate in 1 after Ra1+.");
  });

  test("losing material, from your side", () => {
    const { summary } = explainLine(Chess, {
      fen: START,
      line: ["g1h3", "e7e5", "h3g5", "d8g5"],
      scoreAfter: { cp: -300 },
      kind: "played",
    });
    expect(summary).toBe("Nh3 loses a knight to Qxg5.");
  });

  test("names the capture that wins the most", () => {
    // Nd3?? Qxe3+ Nf2 Rf8 Re1 Qxf2+: a pawn first, then the knight.
    const { summary } = explainLine(Chess, {
      fen: MATE_IN_2,
      line: ["e5d3", "c5e3", "d3f2", "e8f8", "d1e1", "e3f2"],
      scoreAfter: { cp: -419 },
      kind: "played",
    });
    expect(summary).toBe("Nd3 loses a knight to Qxf2+.");
  });

  test("falls back to the eval when nothing is won", () => {
    const quiet = { fen: START, line: ["e2e4", "e7e5"] };
    expect(explainLine(Chess, { ...quiet, scoreAfter: { cp: 30 } }).summary).toBe("e4 keeps the balance (+0.3).");
    expect(explainLine(Chess, { ...quiet, scoreAfter: { cp: 120 } }).summary).toBe("e4 keeps the advantage (+1.2).");
    expect(explainLine(Chess, { ...quiet, scoreAfter: { cp: -250 }, kind: "played" }).summary).toBe(
      "e4 leaves you losing (−2.5).",
    );
  });

  test("Black's evals are read from Black's side", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const { summary } = explainLine(Chess, { fen, line: ["e7e5"], scoreAfter: { cp: -120 } });
    expect(summary).toBe("e5 keeps the advantage (+1.2).");
  });
});
