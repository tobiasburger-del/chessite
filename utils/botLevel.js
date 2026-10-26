// Keeps bot games challenging: win and the bot gets stronger, lose and it
// gets weaker. Levels match BOT_LEVELS in public/js/analysis.js.
const MIN_LEVEL = 1;
const MAX_LEVEL = 6;
// Games shorter than this (plies played after the start) don't move the level,
// so resigning straight away can't farm an easier bot.
const MIN_PLIES = 10;

function nextBotLevel(level, outcome, pliesPlayed) {
  if (pliesPlayed < MIN_PLIES) return level;
  const step = outcome === "win" ? 1 : outcome === "loss" ? -1 : 0;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level + step));
}

module.exports = { nextBotLevel, MIN_LEVEL, MAX_LEVEL, MIN_PLIES };
