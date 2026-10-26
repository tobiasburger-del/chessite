const Drill = require("../models/drill");
const Game = require("../models/game");
const User = require("../models/user");
const { first, outcomeFor } = require("../utils/pgn-parser");
const { nextBotLevel, MIN_LEVEL, MAX_LEVEL } = require("../utils/botLevel");
const { parseSpot, spotLabel } = require("../utils/insights");

// The weak spot this game is built around: a drill and the game it came from.
function presentFocus(d) {
  const youAreWhite = d.user_color === "w";
  return {
    drillId: d.id,
    pgn: d.pgn_raw,
    ply: d.ply,
    fen: d.fen,
    color: d.user_color,
    classification: d.classification,
    opponent: youAreWhite ? d.black_player : d.white_player,
    datePlayed: d.date_played,
    moveLabel: d.move_number + (youAreWhite ? "." : "…"),
  };
}

// GET /play            → practice game around your weakest drill
// GET /play?drill=12   → practice game around that drill ("play it out")
// GET /play?spot=tag:hung-piece → practice game around that kind of mistake
// GET /play?mode=free  → normal game from the starting position
async function show(req, res) {
  const userId = req.session.userId;
  const user = await User.findById(userId);
  const free = req.query.mode === "free";

  const spot = parseSpot(req.query.spot);
  let focus = null;
  if (!free) {
    const drillId = req.query.drill
      ? Number(req.query.drill)
      : await Drill.pickWeakSpotForUser(userId, spot);
    const drill = drillId ? await Drill.findWithGameForUser(drillId, userId) : null;
    if (drill && drill.user_color) focus = presentFocus(drill);
  }

  res.render("play", {
    userId,
    focus,
    free,
    spot: spot ? { key: req.query.spot, label: spotLabel(spot) } : null,
    config: { recommendedLevel: user.bot_level, focus },
  });
}

// Stores a finished bot game and adapts the bot level to the result.
async function save(req, res) {
  const userId = req.session.userId;
  const { pgn, userColor, startPly, level, drillId } = req.body;
  const bad = (error) => res.status(400).json({ error });

  if (typeof pgn !== "string" || pgn.length > 100000) return bad("Missing PGN");
  if (!["w", "b"].includes(userColor)) return bad("Bad color");
  if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) return bad("Bad level");

  let parsed;
  try {
    parsed = first(pgn);
  } catch (err) {
    return bad("Unreadable PGN");
  }
  const plies = parsed.history.length;
  if (!Number.isInteger(startPly) || startPly < 0 || startPly >= plies) {
    return bad("Bad start");
  }

  const gameId = await Game.create(userId, pgn, parsed.header, parsed.history, {
    userColor,
    startPly,
    opening: parsed.header.Opening || null,
  });

  const outcome = outcomeFor(parsed.header.Result, userColor);
  const newLevel = nextBotLevel(level, outcome, plies - startPly);
  await User.setBotLevel(userId, newLevel);
  if (Number.isInteger(drillId)) await Drill.markPlayedForUser(drillId, userId);

  res.json({ id: gameId, outcome, level: newLevel });
}

module.exports = { show, save };
