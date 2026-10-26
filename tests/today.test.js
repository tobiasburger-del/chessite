const { setupSteps } = require("../utils/today");

const none = { connected: false, games: 0, analyzed: 0, attempts: 0, botGames: 0 };
const all = { connected: true, games: 12, analyzed: 4, attempts: 3, botGames: 1 };

describe("setupSteps", () => {
  test("five steps in order", () => {
    expect(setupSteps(none).steps.map((s) => s.key)).toEqual([
      "connect",
      "import",
      "analyze",
      "drill",
      "play",
    ]);
  });

  test("a new account has nothing done and starts at connect", () => {
    const { steps, done } = setupSteps(none);
    expect(done).toBe(false);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(steps.filter((s) => s.current).map((s) => s.key)).toEqual(["connect"]);
  });

  test("each step ticks from its own data", () => {
    const { steps } = setupSteps({ ...none, connected: true, games: 5, analyzed: 1 });
    const done = Object.fromEntries(steps.map((s) => [s.key, s.done]));
    expect(done).toEqual({ connect: true, import: true, analyze: true, drill: false, play: false });
    expect(steps.find((s) => s.current).key).toBe("drill");
  });

  test("the first open step is current even if a later one is done", () => {
    const { steps } = setupSteps({ ...none, botGames: 1, games: 1 });
    expect(steps.find((s) => s.current).key).toBe("connect");
    expect(steps.find((s) => s.key === "play").done).toBe(true);
  });

  test("everything done", () => {
    const { steps, done } = setupSteps(all);
    expect(done).toBe(true);
    expect(steps.some((s) => s.current)).toBe(false);
  });

  test("every step has a link and a button label", () => {
    for (const s of setupSteps(none).steps) {
      expect(s.href).toMatch(/^\//);
      expect(s.cta).toBeTruthy();
      expect(s.title).toBeTruthy();
    }
  });
});
