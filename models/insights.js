const { pool } = require("../config/db");

// Your own analyzed moves (not the opponent's, not replayed bot-game moves).
async function yourMoves(userId) {
  const result = await pool.query(
    `SELECT classification, move_number, fen_after FROM (
        SELECT m.*, g.user_color, g.start_ply,
          ROW_NUMBER() OVER (PARTITION BY m.game_id ORDER BY m.id) AS ply
        FROM move m JOIN game g ON g.id = m.game_id
        WHERE g.user_id = $1 AND g.analyzed_at IS NOT NULL AND g.user_color IS NOT NULL
      ) mv
      WHERE color = user_color AND ply > start_ply AND fen_after IS NOT NULL`,
    [userId],
  );
  return result.rows;
}

// Analyzed games with how many mistakes/blunders you made in each.
async function analyzedGames(userId) {
  const result = await pool.query(
    `SELECT g.id, g.opening, g.result, g.user_color,
        COUNT(m.id) FILTER (WHERE m.color = g.user_color
          AND m.classification IN ('mistake', 'blunder'))::int AS errors
      FROM game g LEFT JOIN move m ON m.game_id = g.id
      WHERE g.user_id = $1 AND g.analyzed_at IS NOT NULL AND g.user_color IS NOT NULL
      GROUP BY g.id`,
    [userId],
  );
  return result.rows;
}

async function drillsWithContext(userId) {
  const result = await pool.query(
    `SELECT d.id, d.phase, d.tags, d.opening_family, d.attempts, d.last_result, d.box,
        d.played_san, m.move_number, g.user_color,
        CASE WHEN g.user_color = 'w' THEN g.black_player ELSE g.white_player END AS opponent
      FROM drill d JOIN game g ON g.id = d.game_id JOIN move m ON m.id = d.move_id
      WHERE d.user_id = $1`,
    [userId],
  );
  return result.rows;
}

async function hasUntaggedDrills(userId) {
  const result = await pool.query(
    "SELECT 1 FROM drill WHERE user_id = $1 AND phase IS NULL LIMIT 1",
    [userId],
  );
  return result.rows.length > 0;
}

module.exports = { yourMoves, analyzedGames, drillsWithContext, hasUntaggedDrills };
