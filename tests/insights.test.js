const { buildInsights, parseSpot, spotLabel } = require("../utils/insights");

const MIDDLE = "r1bq1rk1/pp2bppp/2n1pn2/3p4/3P4/2NBPN2/PP3PPP/R2QK2R w KQ - 0 10";
const ENDING = "8/5k2/8/8/8/8/r4PK1/4R3 w - - 0 50";

function moves(n, fen, moveNumber, errors) {
  return Array.from({ length: n }, (_, i) => ({
    fen_after: fen,
    move_number: moveNumber,
    classification: i < errors ? "blunder" : "good",
  }));
}

const drill = (over) => ({
  id: 1,
  phase: "middlegame",
  tags: [],
  opening_family: null,
  attempts: 0,
  last_result: null,
  played_san: "Qxb2",
  move_number: 20,
  user_color: "w",
  opponent: "Opp",
  box: 0,
  ...over,
});

describe("buildInsights", () => {
  const data = {
    // 30 middlegame moves with 1 error, 30 endgame moves with 6 errors.
    moves: [...moves(30, MIDDLE, 20, 1), ...moves(30, ENDING, 50, 6)],
    games: [
      { opening: "French Defense: Advance Variation", result: "0-1", user_color: "w", errors: 4 },
      { opening: "French Defense: Tarrasch", result: "1-0", user_color: "w", errors: 3 },
      { opening: "Sicilian Defense: Najdorf", result: "1-0", user_color: "w", errors: 0 },
    ],
    drills: [
      drill({ id: 1, phase: "endgame", tags: ["hung-piece"], opening_family: "French Defense" }),
      drill({ id: 2, phase: "endgame", tags: ["hung-piece"], attempts: 2, last_result: false }),
      drill({ id: 3, phase: "middlegame", tags: ["missed-mate"], opening_family: "French Defense" }),
    ],
  };
  const result = buildInsights(data);

  test("totals and per-100 rates", () => {
    expect(result.totals).toEqual({ games: 3, moves: 60, errors: 7, per100: 11.7 });
    const endgame = result.phases.find((p) => p.key === "endgame");
    expect(endgame).toMatchObject({ moves: 30, errors: 6, per100: 20 });
  });

  test("openings grouped by family with score and errors per game", () => {
    expect(result.openings[0]).toEqual({
      family: "French Defense",
      games: 2,
      score: 50,
      errorsPerGame: 3.5,
    });
  });

  test("spots: patterns, weak phases and weak openings that have drills", () => {
    const keys = result.spots.map((s) => s.key);
    expect(keys).toEqual(
      expect.arrayContaining(["tag:hung-piece", "tag:missed-mate", "phase:endgame", "opening:French Defense"]),
    );
    // The middlegame rate is below average, so it's not a weak spot.
    expect(keys).not.toContain("phase:middlegame");
  });

  test("spots you are struggling with come first", () => {
    expect(result.spots[0].key).toBe("tag:hung-piece");
    expect(result.spots[0]).toMatchObject({ drills: 2, struggling: 1 });
    expect(result.spots[0].example).toBe("20. Qxb2 vs Opp");
  });

  test("empty data gives an empty page, not an error", () => {
    const empty = buildInsights({ moves: [], games: [], drills: [] });
    expect(empty.totals.per100).toBe(0);
    expect(empty.spots).toEqual([]);
  });
});

describe("parseSpot", () => {
  test("accepts known kinds", () => {
    expect(parseSpot("tag:hung-piece")).toEqual({ kind: "tag", value: "hung-piece" });
    expect(parseSpot("phase:endgame")).toEqual({ kind: "phase", value: "endgame" });
    expect(parseSpot("opening:French Defense")).toEqual({ kind: "opening", value: "French Defense" });
  });

  test("rejects anything else", () => {
    expect(parseSpot("tag:nope")).toBeNull();
    expect(parseSpot("phase:late")).toBeNull();
    expect(parseSpot("drop table")).toBeNull();
    expect(parseSpot(undefined)).toBeNull();
  });

  test("labels", () => {
    expect(spotLabel(parseSpot("tag:missed-mate"))).toBe("Missing a forced mate");
    expect(spotLabel(parseSpot("opening:French Defense"))).toBe("French Defense");
  });
});
