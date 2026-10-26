const {
  winChance,
  classifyMove,
  classifyGame,
  THRESHOLDS,
} = require("../public/js/moveClassifier.js");

describe("winChance", () => {
  test("equal position is 50%", () => {
    expect(winChance({ cp: 0 })).toBeCloseTo(50);
  });

  test("is symmetric around 50", () => {
    expect(winChance({ cp: 300 }) + winChance({ cp: -300 })).toBeCloseTo(100);
  });

  test("a pawn up is roughly 59%", () => {
    expect(winChance({ cp: 100 })).toBeCloseTo(59.1, 0);
  });

  test("mate scores saturate", () => {
    expect(winChance({ mate: 3 })).toBe(100);
    expect(winChance({ mate: -2 })).toBe(0);
  });
});

describe("classifyMove", () => {
  // Evals are White's point of view.
  test("playing the engine move is best", () => {
    expect(
      classifyMove({ before: { cp: 20 }, after: { cp: -200 }, mover: "w", played: "e2e4", best: "e2e4" }),
    ).toBe("best");
  });

  test("small loss is good", () => {
    expect(
      classifyMove({ before: { cp: 30 }, after: { cp: 10 }, mover: "w", played: "d2d4", best: "e2e4" }),
    ).toBe("good");
  });

  test("white dropping from equal to -1.5 is an inaccuracy", () => {
    expect(
      classifyMove({ before: { cp: 0 }, after: { cp: -150 }, mover: "w", played: "a2a3", best: "e2e4" }),
    ).toBe("inaccuracy");
  });

  test("white dropping from equal to -3 is a mistake", () => {
    expect(
      classifyMove({ before: { cp: 0 }, after: { cp: -300 }, mover: "w", played: "a2a3", best: "e2e4" }),
    ).toBe("mistake");
  });

  test("black hanging a queen is a blunder", () => {
    expect(
      classifyMove({ before: { cp: 0 }, after: { cp: 900 }, mover: "b", played: "d8h4", best: "e7e5" }),
    ).toBe("blunder");
  });

  test("a move that improves black's eval is fine for black", () => {
    expect(
      classifyMove({ before: { cp: 100 }, after: { cp: -50 }, mover: "b", played: "e7e5", best: "c7c5" }),
    ).toBe("good");
  });

  test("allowing a forced mate from a winning position is a blunder", () => {
    expect(
      classifyMove({ before: { cp: 500 }, after: { mate: -3 }, mover: "w", played: "g1h1", best: "d1d8" }),
    ).toBe("blunder");
  });

  test("thresholds are ordered", () => {
    expect(THRESHOLDS.inaccuracy).toBeLessThan(THRESHOLDS.mistake);
    expect(THRESHOLDS.mistake).toBeLessThan(THRESHOLDS.blunder);
  });
});

describe("classifyGame", () => {
  test("labels each ply using the position before and after it", () => {
    // positions: start, after 1.e4, after 1...e5 ?? (pretend black blundered)
    const positions = [
      { score: { cp: 20 }, best: "e2e4" },
      { score: { cp: 30 }, best: "c7c5" },
      { score: { cp: 800 }, best: "g1f3" },
    ];
    const played = ["e2e4", "e7e5"];
    expect(classifyGame(positions, played)).toEqual(["best", "blunder"]);
  });
});
