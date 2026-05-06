const {
  parseInfoLine,
  parseBestmove,
  fenSideToMove,
  toWhitePov,
} = require("../public/js/uci-parsers.js");

describe("parseInfoLine", () => {
  test("parses positive cp score with pv", () => {
    expect(
      parseInfoLine(
        "info depth 12 seldepth 16 multipv 1 score cp 42 nodes 1234 pv e2e4 e7e5"
      )
    ).toEqual({ depth: 12, score: { cp: 42 }, pv: ["e2e4", "e7e5"] });
  });

  test("parses negative cp score", () => {
    expect(parseInfoLine("info depth 8 score cp -150 nodes 100 pv e7e5").score).toEqual({
      cp: -150,
    });
  });

  test("parses positive mate score", () => {
    expect(parseInfoLine("info depth 5 score mate 3 pv f3e5").score).toEqual({ mate: 3 });
  });

  test("parses negative mate score", () => {
    expect(parseInfoLine("info depth 4 score mate -2 pv g1f3").score).toEqual({ mate: -2 });
  });

  test("ignores lowerbound flag but still extracts score", () => {
    expect(
      parseInfoLine("info depth 6 score cp 25 lowerbound nodes 50 pv d2d4").score
    ).toEqual({ cp: 25 });
  });

  test("ignores upperbound flag but still extracts score", () => {
    expect(
      parseInfoLine("info depth 6 score cp -90 upperbound nodes 50 pv d7d5").score
    ).toEqual({ cp: -90 });
  });

  test("returns null for non-info lines", () => {
    expect(parseInfoLine("uciok")).toBeNull();
    expect(parseInfoLine("readyok")).toBeNull();
    expect(parseInfoLine("")).toBeNull();
  });

  test("returns null for info lines with no score", () => {
    expect(parseInfoLine("info depth 1 currmove e2e4 currmovenumber 1")).toBeNull();
    expect(parseInfoLine("info string NNUE evaluation using nn-...")).toBeNull();
  });

  test("captures multi-move pv to end of line", () => {
    expect(
      parseInfoLine("info depth 10 score cp 0 pv e2e4 e7e5 g1f3 b8c6 f1b5").pv
    ).toEqual(["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"]);
  });

  test("returns null for malformed input", () => {
    expect(parseInfoLine(null)).toBeNull();
    expect(parseInfoLine(undefined)).toBeNull();
    expect(parseInfoLine(42)).toBeNull();
  });
});

describe("parseBestmove", () => {
  test("parses simple bestmove", () => {
    expect(parseBestmove("bestmove e2e4")).toEqual({
      from: "e2",
      to: "e4",
      promotion: null,
    });
  });

  test("parses promotion bestmove", () => {
    expect(parseBestmove("bestmove e7e8q")).toEqual({
      from: "e7",
      to: "e8",
      promotion: "q",
    });
  });

  test("ignores ponder suffix", () => {
    expect(parseBestmove("bestmove e2e4 ponder e7e5")).toEqual({
      from: "e2",
      to: "e4",
      promotion: null,
    });
  });

  test("returns null for (none)", () => {
    expect(parseBestmove("bestmove (none)")).toBeNull();
  });

  test("returns null for null move 0000", () => {
    expect(parseBestmove("bestmove 0000")).toBeNull();
  });

  test("returns null for non-bestmove lines", () => {
    expect(parseBestmove("info depth 1 score cp 0")).toBeNull();
  });

  test("returns null for malformed move strings", () => {
    expect(parseBestmove("bestmove zzzz")).toBeNull();
    expect(parseBestmove("bestmove e2e9")).toBeNull();
  });
});

describe("fenSideToMove", () => {
  test("white to move", () => {
    expect(
      fenSideToMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    ).toBe("w");
  });

  test("black to move", () => {
    expect(
      fenSideToMove("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1")
    ).toBe("b");
  });

  test("defaults to white for malformed FEN", () => {
    expect(fenSideToMove("")).toBe("w");
    expect(fenSideToMove("rnbqkbnr")).toBe("w");
    expect(fenSideToMove(null)).toBe("w");
  });
});

describe("toWhitePov", () => {
  test("preserves cp score when white to move", () => {
    expect(toWhitePov({ cp: 100 }, "w")).toEqual({ cp: 100 });
    expect(toWhitePov({ cp: -250 }, "w")).toEqual({ cp: -250 });
  });

  test("flips cp score when black to move", () => {
    expect(toWhitePov({ cp: 100 }, "b")).toEqual({ cp: -100 });
    expect(toWhitePov({ cp: -250 }, "b")).toEqual({ cp: 250 });
  });

  test("preserves mate score when white to move", () => {
    expect(toWhitePov({ mate: 3 }, "w")).toEqual({ mate: 3 });
  });

  test("flips mate score when black to move", () => {
    expect(toWhitePov({ mate: 3 }, "b")).toEqual({ mate: -3 });
    expect(toWhitePov({ mate: -2 }, "b")).toEqual({ mate: 2 });
  });

  test("returns null for null score", () => {
    expect(toWhitePov(null, "w")).toBeNull();
    expect(toWhitePov(null, "b")).toBeNull();
  });
});
