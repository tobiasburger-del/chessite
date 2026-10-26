const {
  first,
  splitPgns,
  detectUserColor,
  sourceUrl,
  openingName,
  outcomeFor,
} = require("../utils/pgn-parser");

const LICHESS_TWO = `[Event "rated blitz game"]
[Site "https://lichess.org/game/3zpz4ABc"]
[White "Sobino106"]
[Black "cutemouse83"]
[Result "0-1"]
[Opening "French Defense: Advance Variation"]

1. e4 e6 2. d4 d5 0-1


[Event "rated blitz game"]
[Site "https://lichess.org/game/p6PZAXbB"]
[White "cutemouse83"]
[Black "Federicov93"]
[Result "1-0"]

1. d4 Nf6 1-0

`;

describe("splitPgns", () => {
  test("splits a multi-game export into one PGN per game", () => {
    const games = splitPgns(LICHESS_TWO);
    expect(games).toHaveLength(2);
    expect(games[0]).toMatch(/^\[Event/);
    expect(games[0]).toContain("1. e4 e6");
    expect(games[1]).toContain("p6PZAXbB");
  });

  test("returns a single game unchanged (trimmed)", () => {
    expect(splitPgns("  [Event \"x\"]\n\n1. e4 *\n")).toEqual([
      '[Event "x"]\n\n1. e4 *',
    ]);
  });

  test("returns nothing for empty input", () => {
    expect(splitPgns("")).toEqual([]);
    expect(splitPgns("   \n")).toEqual([]);
  });
});

describe("detectUserColor", () => {
  const header = { White: "Sobino106", Black: "CuteMouse83" };

  test("matches the black player case-insensitively", () => {
    expect(detectUserColor(header, ["cutemouse83"])).toBe("b");
  });

  test("matches the white player", () => {
    expect(detectUserColor(header, ["nobody", "sobino106"])).toBe("w");
  });

  test("returns null when no username matches", () => {
    expect(detectUserColor(header, ["someoneelse"])).toBeNull();
  });

  test("ignores empty usernames", () => {
    expect(detectUserColor({ White: "", Black: "x" }, ["", null])).toBeNull();
  });
});

describe("sourceUrl", () => {
  test("uses the Chess.com Link header", () => {
    expect(
      sourceUrl({ Site: "Chess.com", Link: "https://www.chess.com/game/live/1" }),
    ).toBe("https://www.chess.com/game/live/1");
  });

  test("uses a Lichess Site URL", () => {
    expect(sourceUrl({ Site: "https://lichess.org/game/abc" })).toBe(
      "https://lichess.org/game/abc",
    );
  });

  test("returns null for non-URL sites", () => {
    expect(sourceUrl({ Site: "Berlin GER" })).toBeNull();
  });
});

describe("openingName", () => {
  test("prefers the Opening header", () => {
    expect(openingName({ Opening: "French Defense" })).toBe("French Defense");
  });

  test("derives a name from the Chess.com ECOUrl", () => {
    expect(
      openingName({
        ECOUrl:
          "https://www.chess.com/openings/Kings-Indian-Attack-Double-Fianchetto-Variation-3.d4-Bg7-4.Bg2",
      }),
    ).toBe("Kings Indian Attack Double Fianchetto Variation");
  });

  test("drops Chess.com's '...' move suffix", () => {
    expect(
      openingName({
        ECOUrl:
          "https://www.chess.com/openings/English-Opening-Four-Knights-Kingside-Fianchetto-Line...5.Bg2-Nxf3-6.Bxf3-Bb4",
      }),
    ).toBe("English Opening Four Knights Kingside Fianchetto Line");
  });

  test("returns null when unknown", () => {
    expect(openingName({})).toBeNull();
  });
});

describe("first", () => {
  test("parses PGNs with Chess.com clock comments", () => {
    const parsed = first(
      '[White "a"]\n[Black "b"]\n\n1. e4 {[%clk 0:03:00]} 1... e5 {[%clk 0:02:59]} *',
    );
    expect(parsed.history).toEqual(["e4", "e5"]);
  });
});

describe("outcomeFor", () => {
  test("wins and losses depend on your side", () => {
    expect(outcomeFor("1-0", "w")).toBe("win");
    expect(outcomeFor("1-0", "b")).toBe("loss");
    expect(outcomeFor("0-1", "b")).toBe("win");
    expect(outcomeFor("0-1", "w")).toBe("loss");
  });

  test("draws", () => {
    expect(outcomeFor("1/2-1/2", "b")).toBe("draw");
  });

  test("unknown side or unfinished game", () => {
    expect(outcomeFor("1-0", null)).toBeNull();
    expect(outcomeFor("*", "w")).toBeNull();
  });
});
