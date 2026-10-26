const { pool } = require("../config/db");

// Every query is scoped to user_id so one user can never read or change
// another user's games.

async function listForUser(userId) {
  const result = await pool.query(
    "SELECT * FROM game WHERE user_id = $1 ORDER BY created_at DESC",
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

async function existsForUser(pgnRaw, userId) {
  const result = await pool.query(
    "SELECT id FROM game WHERE pgn_raw = $1 AND user_id = $2",
    [pgnRaw, userId],
  );
  return result.rows.length > 0;
}

// Inserts the game and its moves in one transaction.
async function create(userId, pgnRaw, header, history) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO game (pgn_raw, white_player, black_player, result, date_played, white_elo, black_elo, site, opening, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        pgnRaw,
        header.White,
        header.Black,
        header.Result,
        header.Date,
        toInt(header.WhiteElo),
        toInt(header.BlackElo),
        header.Site,
        header.Opening,
        userId,
      ],
    );
    const gameId = inserted.rows[0].id;
    for (const [index, san] of history.entries()) {
      await client.query(
        "INSERT INTO move (game_id, move_number, color, san, fen_after) VALUES ($1, $2, $3, $4, $5)",
        [gameId, Math.floor(index / 2) + 1, index % 2 === 0 ? "w" : "b", san, null],
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
};
