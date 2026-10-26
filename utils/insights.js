// Turns your analyzed moves, games and drills into the Insights page: where
// your mistakes cluster, ranked, each linked to drills and practice games.
const { phaseOf, openingFamily } = require("./patterns");
const { outcomeFor } = require("./pgn-parser");

const ERRORS = ["mistake", "blunder"];
const PHASES = [
  { key: "opening", label: "Opening" },
  { key: "middlegame", label: "Middlegame" },
  { key: "endgame", label: "Endgame" },
];
const TAGS = {
  "hung-piece": {
    title: "Leaving pieces hanging",
    description: "Your move let the opponent win a piece straight away.",
  },
  "missed-capture": {
    title: "Missing free material",
    description: "The best move captured a piece, and you played something else.",
  },
  "missed-mate": {
    title: "Missing a forced mate",
    description: "You had a forced mate on the board and let it go.",
  },
  "allowed-mate": {
    title: "Walking into mate",
    description: "Your move gave the opponent a forced mate.",
  },
};
// Phase rates need enough moves to mean anything.
const MIN_PHASE_MOVES = 20;
const MIN_OPENING_GAMES = 2;
const MAX_SPOTS = 6;

const per100 = (errors, moves) => (moves ? Math.round((1000 * errors) / moves) / 10 : 0);

// moves: your analyzed moves { classification, move_number, fen_after }
// games: analyzed games { opening, result, user_color, errors }
// drills: { phase, tags, opening_family, attempts, last_result, played_san, move_number, user_color, opponent, id }
function buildInsights({ moves, games, drills }) {
  const errorCount = moves.filter((m) => ERRORS.includes(m.classification)).length;
  const overall = per100(errorCount, moves.length);

  const phases = PHASES.map(({ key, label }) => {
    const inPhase = moves.filter((m) => phaseOf(m.fen_after, m.move_number) === key);
    const errors = inPhase.filter((m) => ERRORS.includes(m.classification)).length;
    return { key, label, moves: inPhase.length, errors, per100: per100(errors, inPhase.length) };
  });

  const byFamily = new Map();
  for (const g of games) {
    const family = openingFamily(g.opening);
    if (!family) continue;
    const row = byFamily.get(family) || { family, games: 0, points: 0, errors: 0 };
    row.games++;
    row.errors += g.errors;
    const outcome = outcomeFor(g.result, g.user_color);
    row.points += outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0;
    byFamily.set(family, row);
  }
  const openings = [...byFamily.values()]
    .map((r) => ({
      family: r.family,
      games: r.games,
      score: Math.round((100 * r.points) / r.games),
      errorsPerGame: Math.round((10 * r.errors) / r.games) / 10,
    }))
    .sort((a, b) => b.errorsPerGame - a.errorsPerGame || b.games - a.games);
  const avgErrorsPerGame = games.length
    ? games.reduce((sum, g) => sum + g.errors, 0) / games.length
    : 0;

  const spots = [];
  const addSpot = (key, title, description, matches) => {
    const list = drills.filter(matches);
    if (list.length === 0) return;
    const latest = list.reduce((a, b) => (b.id > a.id ? b : a));
    spots.push({
      key,
      title,
      description,
      drills: list.length,
      struggling: list.filter((d) => d.attempts > 0 && d.last_result === false).length,
      example: `${latest.move_number}${latest.user_color === "w" ? "." : "…"} ${latest.played_san} vs ${latest.opponent}`,
    });
  };

  for (const [tag, meta] of Object.entries(TAGS)) {
    addSpot(`tag:${tag}`, meta.title, meta.description, (d) => (d.tags || []).includes(tag));
  }
  for (const p of phases) {
    if (p.moves < MIN_PHASE_MOVES || p.per100 <= overall) continue;
    addSpot(
      `phase:${p.key}`,
      `Mistakes in the ${p.key}`,
      `${p.per100} mistakes per 100 of your moves here, against ${overall} overall.`,
      (d) => d.phase === p.key,
    );
  }
  for (const o of openings) {
    if (o.games < MIN_OPENING_GAMES || o.errorsPerGame <= avgErrorsPerGame) continue;
    addSpot(
      `opening:${o.family}`,
      `Trouble in the ${o.family}`,
      `${o.errorsPerGame} mistake${o.errorsPerGame === 1 ? "" : "s"} per game over ${o.games} games; you score ${o.score}%.`,
      (d) => d.opening_family === o.family,
    );
  }
  spots.sort((a, b) => b.struggling - a.struggling || b.drills - a.drills);

  return {
    totals: { games: games.length, moves: moves.length, errors: errorCount, per100: overall },
    // bar: width (0–100) for the page's per-phase bar chart.
    phases: phases.map((p) => ({
      ...p,
      bar: Math.round((100 * p.per100) / Math.max(...phases.map((q) => q.per100), 1)),
    })),
    openings: openings.slice(0, 8),
    spots: spots.slice(0, MAX_SPOTS),
    progress: {
      drills: drills.length,
      practiced: drills.filter((d) => d.attempts > 0).length,
      learned: drills.filter((d) => d.box >= 3).length,
    },
  };
}

// "tag:hung-piece" → { kind: "tag", value: "hung-piece" }, or null if invalid.
function parseSpot(key) {
  if (typeof key !== "string") return null;
  const [kind, ...rest] = key.split(":");
  const value = rest.join(":");
  if (!value) return null;
  if (kind === "tag" && TAGS[value]) return { kind, value };
  if (kind === "phase" && PHASES.some((p) => p.key === value)) return { kind, value };
  if (kind === "opening" && value.length <= 80) return { kind, value };
  if (kind === "game" && /^[1-9]\d{0,9}$/.test(value)) return { kind, value: Number(value) };
  return null;
}

// Short label for a spot filter banner.
function spotLabel(spot) {
  if (spot.kind === "tag") return TAGS[spot.value].title;
  if (spot.kind === "phase") return `Mistakes in the ${spot.value}`;
  if (spot.kind === "game") return "Mistakes from one game";
  return spot.value;
}

module.exports = { buildInsights, parseSpot, spotLabel, TAGS };
