const { Chess } = require("chess.js");
const {
  legalTargets,
  isPromotion,
  checkedKingSquare,
} = require("../public/js/boardRules.js");

describe("legalTargets", () => {
  test("pawn on its first move has two quiet targets", () => {
    const targets = legalTargets(new Chess(), "e2");
    expect(targets.map((t) => t.to).sort()).toEqual(["e3", "e4"]);
    expect(targets.every((t) => !t.capture)).toBe(true);
  });

  test("marks captures", () => {
    const chess = new Chess("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
    expect(legalTargets(chess, "e4")).toContainEqual({ to: "d5", capture: true });
  });

  test("en passant counts as a capture", () => {
    const chess = new Chess("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    expect(legalTargets(chess, "e5")).toContainEqual({ to: "d6", capture: true });
  });

  test("the four promotion choices collapse into one target", () => {
    const chess = new Chess("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    expect(legalTargets(chess, "a7")).toEqual([{ to: "a8", capture: false }]);
  });

  test("opponent pieces and empty squares have no targets", () => {
    expect(legalTargets(new Chess(), "e7")).toEqual([]);
    expect(legalTargets(new Chess(), "e4")).toEqual([]);
  });
});

describe("isPromotion", () => {
  test("pawn reaching the last rank", () => {
    const chess = new Chess("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    expect(isPromotion(chess, "a7", "a8")).toBe(true);
  });

  test("ordinary moves and illegal moves are not promotions", () => {
    expect(isPromotion(new Chess(), "e2", "e4")).toBe(false);
    expect(isPromotion(new Chess(), "e2", "e5")).toBe(false);
  });
});

describe("checkedKingSquare", () => {
  test("finds the king in check", () => {
    expect(checkedKingSquare(new Chess("4k3/8/8/8/8/8/4q3/4K3 w - - 0 1"))).toBe("e1");
  });

  test("works for black too", () => {
    expect(checkedKingSquare(new Chess("4k3/4Q3/8/8/8/8/8/4K3 b - - 0 1"))).toBe("e8");
  });

  test("null when nobody is in check", () => {
    expect(checkedKingSquare(new Chess())).toBeNull();
  });
});
