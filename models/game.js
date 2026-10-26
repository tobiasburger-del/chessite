const { pool } = require("../config/db");

// Every query is scoped to user_id so one user can never read or change
// another user's games.

async function listForUser(userId) {
  const result = await pool.query(
    "SELECT * FROM game WHERE user_id = $1 ORDER BY date_played DESC NULLS LAST, id DESC",
    [userId],
  );
  return result.rows;
}

async function findForUser(id, userId) {
  const result = await pool.query(
    "SELECT * FROM game WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return result.rows[0];
}

async function listMoves(gameId) {
  const result = await pool.query(
    "SELECT * FROM move WHERE game_id = $1 ORDER BY id",
    [gameId],
  );
  return result.rows;
}

async function existsForUser(pgnRaw, sourceUrl, userId) {
  const result = await pool.query(
    `SELECT id FROM game WHERE user_id = $3
      AND (pgn_raw = $1 OR ($2::text IS NOT NULL AND source_url = $2))`,
    [pgnRaw, sourceUrl, userId],
  );
  return result.rows.length > 0;
}

// Inserts the game and its moves in one transaction.
// meta: { userColor, sourceUrl, opening, startPly }
async function create(userId, pgnRaw, header, history, meta = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO game (pgn_raw, white_player, black_player, result, date_played, white_elo, black_elo, site, opening, user_id, user_color, source_url, start_ply)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [
        pgnRaw,
        header.White,
        header.Black,
        header.Result,
        header.Date,
        toInt(header.WhiteElo),
        toInt(header.BlackElo),
        header.Site,
        meta.opening ?? header.Opening,
        userId,
        meta.userColor ?? null,
        meta.sourceUrl ?? null,
        meta.startPly ?? 0,
      ],
    );
    const gameId = inserted.rows[0].id;
    if (history.length > 0) {
      await client.query(
        `INSERT INTO move (game_id, move_number, color, san)
          SELECT $1, n, c, s FROM unnest($2::int[], $3::text[], $4::text[]) AS t(n, c, s)`,
        [
          gameId,
          history.map((_, i) => Math.floor(i / 2) + 1),
          history.map((_, i) => (i % 2 === 0 ? "w" : "b")),
          history,
        ],
      );
    }
    await client.query("COMMIT");
    return gameId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function removeForUser(id, userId) {
  await pool.query("DELETE FROM game WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
}

async function updateNotesForUser(id, userId, notes) {
  await pool.query(
    "UPDATE game SET notes = $1 WHERE id = $2 AND user_id = $3",
    [notes, id, userId],
  );
}

async function setUserColorForUser(id, userId, color) {
  await pool.query(
    "UPDATE game SET user_color = $1 WHERE id = $2 AND user_id = $3",
    [color, id, userId],
  );
}

// Re-derives user_color for every game whose player names match one of the
// user's chess-site names. Games that match nothing keep their manual side.
async function recomputeUserColors(userId, usernames) {
  const names = usernames.map((u) => u.toLowerCase());
  await pool.query(
    `UPDATE game SET user_color = CASE
        WHEN lower(white_player) = ANY($2::text[]) THEN 'w'
        WHEN lower(black_player) = ANY($2::text[]) THEN 'b'
      END
      WHERE user_id = $1
        AND (lower(white_player) = ANY($2::text[]) OR lower(black_player) = ANY($2::text[]))`,
    [userId, names],
  );
}

// Games still waiting for engine analysis, newest first. Only games where we
// know your side, since only those produce drills.
// Game page URLs already in the library, to skip known online games.
async function sourceUrlsForUser(userId) {
  const result = await pool.query(
    "SELECT source_url FROM game WHERE user_id = $1 AND source_url IS NOT NULL",
    [userId],
  );
  return new Set(result.rows.map((r) => r.source_url));
}

// How many games came from each site.
async function countBySourceForUser(userId) {
  const result = await pool.query(
    `SELECT
        COUNT(*) FILTER (WHERE source_url LIKE 'https://lichess.org/%')::int AS lichess,
        COUNT(*) FILTER (WHERE source_url LIKE 'https://www.chess.com/%')::int AS chesscom
      FROM game WHERE user_id = $1`,
    [userId],
  );
  return result.rows[0];
}

async function listUnanalyzedForUser(userId) {
  const result = await pool.query(
    `SELECT id, pgn_raw FROM game
      WHERE user_id = $1 AND analyzed_at IS NULL AND user_color IS NOT NULL
      ORDER BY date_played DESC NULLS LAST, id DESC`,
    [userId],
  );
  return result.rows;
}

// Saves engine results for every move of a game, matched to moves by order.
// moves[i]: { fenAfter, evalCp, evalMate, bestMove, bestSan, classification }
async function saveAnalysisForUser(id, userId, { depth, startEvalCp, moves }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE game SET analysis_depth = $1, start_eval_cp = $2, analyzed_at = NOW()
        WHERE id = $3 AND user_id = $4`,
      [depth, startEvalCp, id, userId],
    );
    if (updated.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      `UPDATE move SET fen_after = a.fen_after, eval_cp = a.eval_cp, eval_mate = a.eval_mate,
          best_move = a.best_move, best_san = a.best_san, classification = a.classification
        FROM (
          SELECT id, row_number() OVER (ORDER BY id) AS ply FROM move WHERE game_id = $1
        ) m
        JOIN unnest($2::text[], $3::int[], $4::int[], $5::text[], $6::text[], $7::text[])
          WITH ORDINALITY AS a(fen_after, eval_cp, eval_mate, best_move, best_san, classification, ply)
          ON a.ply = m.ply
        WHERE move.id = m.id`,
      [
        id,
        moves.map((m) => m.fenAfter),
        moves.map((m) => m.evalCp),
        moves.map((m) => m.evalMate),
        moves.map((m) => m.bestMove),
        moves.map((m) => m.bestSan),
        moves.map((m) => m.classification),
      ],
    );
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// PGN headers use "?" for unknown ratings; INTEGER columns reject that.
function toInt(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

module.exports = {
  listForUser,
  findForUser,
  listMoves,
  existsForUser,
  create,
  removeForUser,
  updateNotesForUser,
  setUserColorForUser,
  recomputeUserColors,
  saveAnalysisForUser,
  listUnanalyzedForUser,
  sourceUrlsForUser,
  countBySourceForUser,
};
