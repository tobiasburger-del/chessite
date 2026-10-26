const { pool } = require("../config/db");

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const DRILL_LABELS = ["mistake", "blunder"];

// Brings drills in line with the current analysis and side for the user's
// games (or one game): every mistake/blunder you made becomes a drill, and
// drills whose move no longer qualifies are removed. Progress is kept.
// Moves before a game's start_ply (copied from an earlier game) are skipped.
async function syncForUser(userId, gameId = null) {
  await pool.query(
    `WITH mv AS (
        SELECT m.*, g.user_id, g.user_color,
          COALESCE(LAG(m.fen_after) OVER w, $3) AS fen_before,
          COALESCE(LAG(m.eval_cp) OVER w, CASE WHEN ROW_NUMBER() OVER w = 1 THEN g.start_eval_cp END) AS before_cp,
          LAG(m.eval_mate) OVER w AS before_mate,
          ROW_NUMBER() OVER w AS ply, g.start_ply
        FROM move m JOIN game g ON g.id = m.game_id
        WHERE g.user_id = $1 AND ($2::int IS NULL OR g.id = $2) AND g.analyzed_at IS NOT NULL
        WINDOW w AS (PARTITION BY m.game_id ORDER BY m.id)
      )
      INSERT INTO drill (user_id, game_id, move_id, fen, played_san, best_move, best_san,
                         classification, eval_before_cp, eval_before_mate, eval_after_cp, eval_after_mate)
      SELECT user_id, game_id, id, fen_before, san, best_move, best_san,
             classification, before_cp, before_mate, eval_cp, eval_mate
      FROM mv
      WHERE color = user_color AND classification = ANY($4::text[]) AND best_move IS NOT NULL
        AND ply > start_ply
        -- One drill per position: the same mistake in another game is not a new drill.
        AND NOT EXISTS (
          SELECT 1 FROM drill d2
          WHERE d2.user_id = mv.user_id AND d2.fen = mv.fen_before AND d2.move_id <> mv.id
        )
      ON CONFLICT (move_id) DO UPDATE SET
        fen = EXCLUDED.fen, played_san = EXCLUDED.played_san,
        best_move = EXCLUDED.best_move, best_san = EXCLUDED.best_san,
        classification = EXCLUDED.classification,
        eval_before_cp = EXCLUDED.eval_before_cp, eval_before_mate = EXCLUDED.eval_before_mate,
        eval_after_cp = EXCLUDED.eval_after_cp, eval_after_mate = EXCLUDED.eval_after_mate`,
    [userId, gameId, START_FEN, DRILL_LABELS],
  );
  await pool.query(
    `DELETE FROM drill d USING move m, game g
      WHERE d.move_id = m.id AND m.game_id = g.id
        AND d.user_id = $1 AND ($2::int IS NULL OR d.game_id = $2)
        AND NOT (m.color IS NOT DISTINCT FROM g.user_color
                 AND m.classification = ANY($3::text[]) AND m.best_move IS NOT NULL)`,
    [userId, gameId, DRILL_LABELS],
  );
}

// The drill due soonest (blunders first within a day), with its game for context.
async function nextDueForUser(userId) {
  const result = await pool.query(
    `SELECT d.*, g.white_player, g.black_player, g.user_color, g.date_played,
            g.opening, m.move_number
      FROM drill d JOIN game g ON g.id = d.game_id JOIN move m ON m.id = d.move_id
      WHERE d.user_id = $1 AND d.due_at <= NOW()
      ORDER BY date_trunc('day', d.due_at), (d.classification = 'blunder') DESC, d.due_at, d.id
      LIMIT 1`,
    [userId],
  );
  return result.rows[0];
}

// The weak spot for a practice game: a drill you have practiced, preferring
// ones you got wrong last time, then the least reliable, then the least
// recently played out. Falls back to drills you have not tried yet.
async function pickWeakSpotForUser(userId) {
  const result = await pool.query(
    `SELECT d.id FROM drill d
      WHERE d.user_id = $1
      ORDER BY (d.attempts > 0) DESC,
        (d.last_result IS FALSE) DESC,
        d.successes::float / GREATEST(d.attempts, 1),
        d.last_played_at NULLS FIRST,
        random()
      LIMIT 1`,
    [userId],
  );
  return result.rows[0] ? result.rows[0].id : null;
}

// A drill plus its source game, for replaying the game into the mistake.
async function findWithGameForUser(id, userId) {
  const result = await pool.query(
    `SELECT d.*, g.pgn_raw, g.user_color, g.white_player, g.black_player,
        g.date_played, m.move_number,
        (SELECT COUNT(*) FROM move m2 WHERE m2.game_id = m.game_id AND m2.id <= m.id)::int AS ply
      FROM drill d JOIN game g ON g.id = d.game_id JOIN move m ON m.id = d.move_id
      WHERE d.id = $1 AND d.user_id = $2`,
    [id, userId],
  );
  return result.rows[0];
}

async function markPlayedForUser(id, userId) {
  await pool.query(
    "UPDATE drill SET last_played_at = NOW() WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
}

async function countForGame(gameId, userId) {
  const result = await pool.query(
    "SELECT COUNT(*)::int AS n FROM drill WHERE game_id = $1 AND user_id = $2",
    [gameId, userId],
  );
  return result.rows[0].n;
}

async function statsForUser(userId) {
  const result = await pool.query(
    `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE due_at <= NOW())::int AS due,
        COUNT(*) FILTER (WHERE box >= 3)::int AS learned,
        MIN(due_at) FILTER (WHERE due_at > NOW()) AS next_due
      FROM drill WHERE user_id = $1`,
    [userId],
  );
  return result.rows[0];
}

async function findForUser(id, userId) {
  const result = await pool.query(
    "SELECT * FROM drill WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return result.rows[0];
}

async function recordResultForUser(id, userId, correct, { box, dueAt }) {
  await pool.query(
    `UPDATE drill SET box = $1, due_at = $2, attempts = attempts + 1,
        successes = successes + $3::int, last_result = $4
      WHERE id = $5 AND user_id = $6`,
    [box, dueAt, correct ? 1 : 0, correct, id, userId],
  );
}

module.exports = {
  syncForUser,
  nextDueForUser,
  statsForUser,
  findForUser,
  recordResultForUser,
  pickWeakSpotForUser,
  findWithGameForUser,
  markPlayedForUser,
  countForGame,
};
