const { displayDate } = require("../utils/dates");

describe("displayDate", () => {
  test("PGN dates read like a person would write them", () => {
    expect(displayDate("2026.10.06")).toBe("6 Oct 2026");
    expect(displayDate("2025.01.31")).toBe("31 Jan 2025");
  });

  test("unknown or missing dates give an empty string", () => {
    expect(displayDate("????.??.??")).toBe("");
    expect(displayDate(null)).toBe("");
    expect(displayDate("")).toBe("");
  });

  test("a partly known date keeps what is known", () => {
    expect(displayDate("2026.??.??")).toBe("2026");
    expect(displayDate("2026.10.??")).toBe("Oct 2026");
  });
});
