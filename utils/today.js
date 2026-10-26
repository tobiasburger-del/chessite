// The setup checklist on the Today page. Each step ticks itself from your
// data; the first open one is "current" and gets the main button.

const STEPS = [
  {
    key: "connect",
    title: "Connect your account",
    text: "Your Lichess or Chess.com username, so we can fetch your games.",
    href: "/import",
    cta: "Connect",
    isDone: (p) => p.connected,
  },
  {
    key: "import",
    title: "Import your games",
    text: "Your own games are what we train on.",
    href: "/import",
    cta: "Import games",
    isDone: (p) => p.games > 0,
  },
  {
    key: "analyze",
    title: "Analyze them",
    text: "Stockfish checks every move and turns your mistakes into drills.",
    href: "/games",
    cta: "Analyze",
    isDone: (p) => p.analyzed > 0,
  },
  {
    key: "drill",
    title: "Do your first drill",
    text: "Find the better move in a position you once got wrong.",
    href: "/train",
    cta: "Start training",
    isDone: (p) => p.attempts > 0,
  },
  {
    key: "play",
    title: "Play your first bot game",
    text: "The bot steers you back into a position you struggle with.",
    href: "/play",
    cta: "Play",
    isDone: (p) => p.botGames > 0,
  },
];

// progress: { connected, games, analyzed, attempts, botGames }
function setupSteps(progress) {
  let currentFound = false;
  const steps = STEPS.map(({ isDone, ...step }) => {
    const done = Boolean(isDone(progress));
    const current = !done && !currentFound;
    if (current) currentFound = true;
    return { ...step, done, current };
  });
  return { steps, done: !currentFound };
}

module.exports = { setupSteps };
