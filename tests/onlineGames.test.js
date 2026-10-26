const { pgnSourceUrl, newestUnknown } = require("../utils/onlineGames");

const lichess = (id) => `[Event "Rated blitz game"]\n[Site "https://lichess.org/${id}"]\n\n1. e4 e5 *`;
const chesscom = (id) =>
  `[Event "Live Chess"]\n[Site "Chess.com"]\n[Link "https://www.chess.com/game/live/${id}"]\n\n1. d4 d5 *`;
const pasted = `[Event "Club"]\n[Site "Berlin"]\n\n1. c4 *`;

describe("pgnSourceUrl", () => {
  test("Lichess games use the Site URL", () => {
    expect(pgnSourceUrl(lichess("abc"))).toBe("https://lichess.org/abc");
  });

  test("Chess.com games use the Link header", () => {
    expect(pgnSourceUrl(chesscom(42))).toBe("https://www.chess.com/game/live/42");
  });

  test("no URL gives null", () => {
    expect(pgnSourceUrl(pasted)).toBeNull();
  });
});

describe("newestUnknown", () => {
  const known = new Set(["https://lichess.org/old1", "https://lichess.org/old2"]);
  const isKnown = (url) => known.has(url);

  test("stops at the first game already in the library", () => {
    const pgns = [lichess("new1"), lichess("new2"), lichess("old1"), lichess("new3")];
    expect(newestUnknown(pgns, isKnown)).toEqual([lichess("new1"), lichess("new2")]);
  });

  test("keeps everything when nothing is known", () => {
    const pgns = [lichess("a"), lichess("b")];
    expect(newestUnknown(pgns, isKnown)).toEqual(pgns);
  });

  test("nothing new gives an empty list", () => {
    expect(newestUnknown([lichess("old2"), lichess("old1")], isKnown)).toEqual([]);
    expect(newestUnknown([], isKnown)).toEqual([]);
  });

  test("games without a URL count as new", () => {
    expect(newestUnknown([pasted, lichess("old1")], isKnown)).toEqual([pasted]);
  });
});
