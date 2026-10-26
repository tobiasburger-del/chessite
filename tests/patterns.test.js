const {
  pieceAt,
  nonPawnMaterial,
  phaseOf,
  tagsFor,
  openingFamily,
} = require("../utils/patterns");

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// After 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? — White to play Qxf7#.
const SCHOLAR = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
const ROOK_ENDING = "8/5k2/8/8/8/8/r4PK1/4R3 w - - 0 50";

describe("pieceAt", () => {
  test("reads pieces from a FEN", () => {
    expect(pieceAt(START, "e1")).toBe("K");
    expect(pieceAt(START, "d8")).toBe("q");
    expect(pieceAt(START, "e4")).toBeNull();
    expect(pieceAt(SCHOLAR, "h5")).toBe("Q");
    expect(pieceAt(SCHOLAR, "f6")).toBe("n");
  });
});

describe("phaseOf", () => {
  test("material counts minor and major pieces only", () => {
    expect(nonPawnMaterial(START)).toBe(62);
    expect(nonPawnMaterial(ROOK_ENDING)).toBe(10);
  });

  test("early moves are the opening", () => {
    expect(phaseOf(START, 1)).toBe("opening");
  });

  test("full material after move 12 is the middlegame", () => {
    expect(phaseOf(START, 20)).toBe("middlegame");
  });

  test("little material left is the endgame, whatever the move number", () => {
    expect(phaseOf(ROOK_ENDING, 50)).toBe("endgame");
    expect(phaseOf(ROOK_ENDING, 8)).toBe("endgame");
  });
});

describe("tagsFor", () => {
  test("missing a forced mate", () => {
    expect(
      tagsFor({ color: "w", evalBefore: { mate: 2 }, evalAfter: { cp: 300 } }),
    ).toContain("missed-mate");
  });

  test("walking into a forced mate (as Black)", () => {
    // Before 3...Nf6 Black is fine; after it White mates in one.
    expect(
      tagsFor({ color: "b", evalBefore: { cp: -30 }, evalAfter: { mate: 1 } }),
    ).toContain("allowed-mate");
  });

  test("a mate you still have is not missed", () => {
    expect(
      tagsFor({ color: "b", evalBefore: { mate: -3 }, evalAfter: { mate: -5 } }),
    ).not.toContain("missed-mate");
  });

  test("leaving a piece hanging: the opponent's best reply captures it", () => {
    // White to move; Black's queen on h4 could be taken by the knight on f3.
    const fenAfter = "rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
    expect(
      tagsFor({ color: "b", fenAfter, nextBestMove: "f3h4", evalBefore: { cp: 0 }, evalAfter: { cp: 900 } }),
    ).toContain("hung-piece");
  });

  test("a pawn capture reply is not a hung piece", () => {
    const fenAfter = "rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2";
    expect(
      tagsFor({ color: "w", fenAfter, nextBestMove: "e5d4", evalBefore: { cp: 0 }, evalAfter: { cp: -150 } }),
    ).not.toContain("hung-piece");
  });

  test("missing a capture of a piece", () => {
    // Black to move could take the white queen on h5 with the knight on f6.
    const fen = "rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 3 3";
    expect(
      tagsFor({ color: "b", fen, bestMove: "f6h5", evalBefore: { cp: -800 }, evalAfter: { cp: 50 } }),
    ).toContain("missed-capture");
  });

  test("no tags without the needed data", () => {
    expect(tagsFor({ color: "w" })).toEqual([]);
  });
});

describe("openingFamily", () => {
  test("Lichess names: the part before the colon", () => {
    expect(openingFamily("French Defense: Advance Variation")).toBe("French Defense");
  });

  test("Chess.com names: up to the first Opening/Defense/Attack/...", () => {
    expect(openingFamily("English Opening Four Knights Kingside Fianchetto Line")).toBe("English Opening");
    expect(openingFamily("Kings Indian Attack Double Fianchetto Variation")).toBe("Kings Indian Attack");
  });

  test("falls back to the first two words, or null", () => {
    expect(openingFamily("Ruy Lopez Morphy Lines")).toBe("Ruy Lopez");
    expect(openingFamily(null)).toBeNull();
    expect(openingFamily("")).toBeNull();
  });
});
