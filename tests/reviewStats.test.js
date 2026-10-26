const { moveScore, summarize, accuracy } = require("../utils/analysis");

// Rows as stored in `move`: evals are White's view after the move.
const row = (color, classification, evalCp, evalMate = null) => ({
  color,
  classification,
  eval_cp: evalCp,
  eval_mate: evalMate,
});

describe("moveScore", () => {
  test("prefers mate over centipawns", () => {
    expect(moveScore({ eval_cp: 30, eval_mate: 2 })).toEqual({ mate: 2 });
    expect(moveScore({ eval_cp: 30, eval_mate: null })).toEqual({ cp: 30 });
    expect(moveScore({ eval_cp: null, eval_mate: null })).toBeNull();
  });
});

describe("summarize", () => {
  test("skips moves before startPly", () => {
    const moves = [
      row("w", "blunder", -300),
      row("b", "mistake", -300),
      row("w", "inaccuracy", -300),
    ];
    expect(summarize(moves, 2).w).toEqual({ inaccuracy: 1, mistake: 0, blunder: 0 });
    expect(summarize(moves, 2).b).toEqual({ inaccuracy: 0, mistake: 0, blunder: 0 });
  });
});

describe("accuracy", () => {
  test("no change in evaluation is 100% for both sides", () => {
    const moves = [row("w", "best", 20), row("b", "best", 20), row("w", "good", 20)];
    expect(accuracy(moves, { cp: 20 })).toEqual({ w: 100, b: 100 });
  });

  test("a big swing costs the side that made it", () => {
    const moves = [row("w", "blunder", -300), row("b", "best", -300)];
    const acc = accuracy(moves, { cp: 0 });
    expect(acc.w).toBeLessThan(50);
    expect(acc.b).toBe(100);
  });

  test("replayed moves are not counted", () => {
    const moves = [row("w", "blunder", -300), row("b", "best", -300), row("w", "best", -300)];
    expect(accuracy(moves, { cp: 0 }, 2)).toEqual({ w: 100, b: null });
  });

  test("a side without evaluated moves is null", () => {
    expect(accuracy([row("w", "best", null)], { cp: 0 })).toEqual({ w: null, b: null });
  });

  test("mate scores give finite numbers", () => {
    const moves = [row("w", "best", null, 3), row("b", "blunder", null, 1)];
    const acc = accuracy(moves, { cp: 0 });
    expect(Number.isFinite(acc.w)).toBe(true);
    expect(Number.isFinite(acc.b)).toBe(true);
  });
});
