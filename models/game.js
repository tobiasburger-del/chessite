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
// meta: { userColor, sourceUrl, opening }
async function create(userId, pgnRaw, header, history, meta = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO game (pgn_raw, white_player, black_player, result, date_played, white_elo, black_elo, site, opening, user_id, user_color, source_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
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
};
