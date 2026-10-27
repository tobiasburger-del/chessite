const { Chess } = require("chess.js");
const { playLine, describeTrade, explainLine, commentFor, MAX_PLIES } = require("../public/js/explain.js");

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
    expect(describeTrade(["b"], ["n"])).toBeNull();
    expect(describeTrade(["r", "b"], ["n"])).toBe("a rook");
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

  test("adds the eval when the material lost is only part of the drop", () => {
    const line = ["e2e4", "d7d5", "g1f3", "b8c6", "b1c3", "d5e4"];
    const { summary } = explainLine(Chess, {
      fen: START,
      line,
      scoreBefore: { cp: 30 },
      scoreAfter: { cp: -420 },
      kind: "played",
    });
    expect(summary).toBe("e4 loses a pawn to dxe4 and leaves you losing (−4.2).");
  });

  test("falls back to the eval when nothing is won", () => {
    const quiet = { fen: START, line: ["e2e4", "e7e5"] };
    expect(explainLine(Chess, { ...quiet, scoreAfter: { cp: 30 } }).summary).toBe("e4 keeps the balance (+0.3).");
    expect(explainLine(Chess, { ...quiet, scoreAfter: { cp: -3 } }).summary).toBe("e4 keeps the balance (0.0).");
    expect(explainLine(Chess, { ...quiet, scoreAfter: { cp: 120 } }).summary).toBe("e4 keeps the advantage (+1.2).");
    expect(explainLine(Chess, { ...quiet, scoreAfter: { cp: -250 }, kind: "played" }).summary).toBe(
      "e4 leaves you losing (−2.5).",
    );
  });

  test("an error says what it threw away, with the eval swing", () => {
    const quiet = { fen: START, line: ["e2e4", "e7e5"], kind: "played" };
    const swing = (before, after) =>
      explainLine(Chess, { ...quiet, scoreBefore: { cp: before }, scoreAfter: { cp: after } }).summary;
    expect(swing(210, -90)).toBe("e4 throws away a winning position and leaves you worse (+2.1 → −0.9).");
    expect(swing(250, 100)).toBe("e4 throws away a winning position (+2.5 → +1.0).");
    expect(swing(120, 0)).toBe("e4 throws away your advantage (+1.2 → 0.0).");
    // A small drop, or one from an equal position, keeps the plain wording.
    expect(swing(120, 60)).toBe("e4 lets the position level out (+0.6).");
    expect(swing(30, -250)).toBe("e4 leaves you losing (−2.5).");
  });

  test("Black's evals are read from Black's side", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const { summary } = explainLine(Chess, { fen, line: ["e7e5"], scoreAfter: { cp: -120 } });
    expect(summary).toBe("e5 keeps the advantage (+1.2).");
  });
});

describe("explainLine keeps material claims honest", () => {
  test("an error never 'wins' material; the eval speaks instead", () => {
    const { summary } = explainLine(Chess, {
      fen: START,
      line: ["e2e4", "d7d5", "e4d5", "g8f6"],
      scoreAfter: { cp: -80 },
      kind: "played",
    });
    expect(summary).toBe("e4 leaves you worse (−0.8).");
  });

  test("the best move never 'loses' material", () => {
    const { summary } = explainLine(Chess, {
      fen: START,
      line: ["g1h3", "e7e5", "h3g5", "d8g5"],
      scoreAfter: { cp: 20 },
    });
    expect(summary).toBe("Nh3 keeps the balance (+0.2).");
  });

  test("a loss is only named when the eval drop backs it up", () => {
    const loss = { fen: START, line: ["g1h3", "e7e5", "h3g5", "d8g5"], kind: "played" };
    expect(explainLine(Chess, { ...loss, scoreBefore: { cp: 30 }, scoreAfter: { cp: -10 } }).summary).toBe(
      "Nh3 lets the position level out (−0.1).",
    );
    expect(explainLine(Chess, { ...loss, scoreBefore: { cp: 30 }, scoreAfter: { cp: -300 } }).summary).toBe(
      "Nh3 loses a knight to Qxg5.",
    );
  });

  test("a capture that gets recaptured right after the cut isn't counted", () => {
    // Six plies end on dxe4, but the line goes on with Nxe4: no pawn is lost.
    const line = ["e2e4", "d7d5", "g1f3", "b8c6", "b1c3", "d5e4", "c3e4"];
    const { summary } = explainLine(Chess, { fen: START, line, scoreAfter: { cp: 10 }, kind: "played" });
    expect(summary).toBe("e4 lets the position level out (+0.1).");
    // The same six plies as the whole line, or followed by a move elsewhere:
    // the pawn is gone.
    const short = explainLine(Chess, { fen: START, line: line.slice(0, 6), scoreAfter: { cp: 10 }, kind: "played" });
    expect(short.summary).toBe("e4 loses a pawn to dxe4.");
    const elsewhere = explainLine(Chess, {
      fen: START,
      line: [...line.slice(0, 6), "f3g5"],
      scoreAfter: { cp: 10 },
      kind: "played",
    });
    expect(elsewhere.summary).toBe("e4 loses a pawn to dxe4.");
  });
});

describe("commentFor", () => {
  // From the drill: Nd3?? instead of Qf7+ (mate in 2).
  const blunder = {
    fen: MATE_IN_2,
    played: "e5d3",
    bestMove: "f1f7",
    playedLine: ["c5e3", "d3f2", "e8f8", "d1e1", "e3f2"],
    bestLine: ["f1f7", "g8h8", "e5g6"],
    scoreAfter: { cp: -419 },
    scoreBefore: { mate: 2 },
  };

  test("no comment for the best move", () => {
    expect(commentFor(Chess, { ...blunder, classification: "best" })).toBeNull();
    expect(commentFor(Chess, { ...blunder, played: "f1f7", classification: "good" })).toBeNull();
  });

  test("an error says what it does and what was better", () => {
    expect(commentFor(Chess, { ...blunder, classification: "blunder" })).toBe(
      "Nd3 loses a knight to Qxf2+ and leaves you losing (−4.2). Better: Qf7+ forces mate in 2.",
    );
  });

  test("a good move names the slightly better one", () => {
    const good = {
      fen: START,
      played: "g1f3",
      bestMove: "e2e4",
      bestLine: ["e2e4", "e7e5"],
      scoreBefore: { cp: 35 },
      classification: "good",
    };
    expect(commentFor(Chess, good)).toBe("Fine. e4 was a touch more precise (+0.4).");
  });

  test("a best move that mates at once", () => {
    // Back-rank mate: Re8#.
    const fen = "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1";
    const comment = commentFor(Chess, {
      fen,
      played: "h2h3",
      bestMove: "e1e8",
      bestLine: ["e1e8"],
      playedLine: ["g8f8"],
      scoreBefore: { mate: 1 },
      scoreAfter: { cp: 500 },
      classification: "mistake",
    });
    expect(comment).toBe("h3 throws away a forced mate (+5.0). Better: Re8# is checkmate.");
  });

  test("works without engine lines", () => {
    expect(
      commentFor(Chess, { ...blunder, playedLine: null, bestLine: null, classification: "blunder" }),
    ).toBe("Nd3 throws away a forced mate and leaves you losing (−4.2). Better: Qf7+ forces mate in 2.");
  });
});
