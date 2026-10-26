const { nextReview, INTERVAL_DAYS, MAX_BOX } = require("../utils/srs");

const NOW = new Date("2026-10-26T12:00:00Z");
const daysLater = (d) => new Date(NOW.getTime() + d * 86400000);

describe("nextReview", () => {
  test("a new drill solved goes to box 1, due tomorrow", () => {
    expect(nextReview(0, true, NOW)).toEqual({ box: 1, dueAt: daysLater(1) });
  });

  test("each success moves up a box: 1 → 3 → 7 → 21 days", () => {
    expect(nextReview(1, true, NOW)).toEqual({ box: 2, dueAt: daysLater(3) });
    expect(nextReview(2, true, NOW)).toEqual({ box: 3, dueAt: daysLater(7) });
    expect(nextReview(3, true, NOW)).toEqual({ box: 4, dueAt: daysLater(21) });
  });

  test("the top box keeps its interval", () => {
    const top = nextReview(MAX_BOX, true, NOW);
    expect(top.box).toBe(MAX_BOX);
    expect(top.dueAt).toEqual(daysLater(INTERVAL_DAYS[MAX_BOX]));
  });

  test("a miss drops back to box 0 and comes back tomorrow", () => {
    expect(nextReview(3, false, NOW)).toEqual({ box: 0, dueAt: daysLater(1) });
  });
});
