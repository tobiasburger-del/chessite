const { drillView, squaresOf, ideaHint } = require("../utils/drillView");

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const AFTER_E4_E5 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";

describe("squaresOf", () => {
  test("turns SAN into from/to squares", () => {
    expect(squaresOf(START, "Nf3")).toEqual({ from: "g1", to: "f3" });
  });

  test("returns null for a move that doesn't fit the position", () => {
    expect(squaresOf(START, "Qxf7")).toBeNull();
    expect(squaresOf(null, "e4")).toBeNull();
  });
});

describe("ideaHint", () => {
  test("uses the most telling tag", () => {
    expect(ideaHint({ tags: ["hung-piece", "missed-capture"] })).toMatch(/material to win/);
    expect(ideaHint({ tags: ["missed-mate", "missed-capture"] })).toMatch(/forced mate/);
  });

  test("falls back to the eval from your side", () => {
    expect(ideaHint({ tags: [], evalBefore: { cp: -140 }, color: "b" })).toMatch(/better here \(\+1\.4\)/);
    expect(ideaHint({ tags: [], evalBefore: { cp: -300 }, color: "w" })).toMatch(/already worse/);
    expect(ideaHint({ tags: [], evalBefore: { cp: 20 }, color: "w" })).toMatch(/about equal/);
    expect(ideaHint({ tags: null, evalBefore: null })).toMatch(/check, capture/);
  });
});

describe("drillView", () => {
  test("shows the opponent's last move and the move you played", () => {
    const view = drillView({
      fen: AFTER_E4_E5,
      playedSan: "Qh5",
      prevSan: "e5",
      prevFenBefore: AFTER_E4,
      tags: [],
      color: "w",
    });
    expect(view.sideToMove).toBe("White");
    expect(view.lastMove).toEqual({ from: "e7", to: "e5" });
    expect(view.playedMove).toEqual({ from: "d1", to: "h5" });
  });

  test("the first move of the game comes from the start position", () => {
    const view = drillView({ fen: AFTER_E4, playedSan: "e5", prevSan: "e4", prevFenBefore: null, color: "b" });
    expect(view.sideToMove).toBe("Black");
    expect(view.lastMove).toEqual({ from: "e2", to: "e4" });
  });

  test("no last move when you moved first", () => {
    expect(drillView({ fen: START, playedSan: "e4", prevSan: null, color: "w" }).lastMove).toBeNull();
  });
});
