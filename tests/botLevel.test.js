const { nextBotLevel, MIN_LEVEL, MAX_LEVEL, MIN_PLIES } = require("../utils/botLevel");

describe("nextBotLevel", () => {
  test("a win moves the bot up a level", () => {
    expect(nextBotLevel(3, "win", 40)).toBe(4);
  });

  test("a loss moves the bot down a level", () => {
    expect(nextBotLevel(3, "loss", 40)).toBe(2);
  });

  test("a draw keeps the level", () => {
    expect(nextBotLevel(3, "draw", 40)).toBe(3);
  });

  test("stays within the available levels", () => {
    expect(nextBotLevel(MAX_LEVEL, "win", 40)).toBe(MAX_LEVEL);
    expect(nextBotLevel(MIN_LEVEL, "loss", 40)).toBe(MIN_LEVEL);
  });

  test("very short games do not count", () => {
    expect(nextBotLevel(3, "loss", MIN_PLIES - 1)).toBe(3);
  });

  test("unknown outcome keeps the level", () => {
    expect(nextBotLevel(3, null, 40)).toBe(3);
  });
});
