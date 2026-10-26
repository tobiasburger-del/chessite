const { pool } = require("../config/db");

async function create(email, passwordHash) {
  await pool.query("INSERT INTO users (email, password_hash) VALUES ($1, $2)", [
    email,
    passwordHash,
  ]);
}

async function findByEmail(email) {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0];
}

async function findById(id) {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0];
}

async function updateUsernames(id, lichess, chesscom) {
  await pool.query(
    "UPDATE users SET lichess_username = $1, chesscom_username = $2 WHERE id = $3",
    [lichess || null, chesscom || null, id],
  );
}

// field is "lichess_username" or "chesscom_username".
async function setUsername(id, field, name) {
  const column = { lichess_username: "lichess_username", chesscom_username: "chesscom_username" }[field];
  await pool.query(`UPDATE users SET ${column} = $1 WHERE id = $2`, [name || null, id]);
}

async function setBotLevel(id, level) {
  await pool.query("UPDATE users SET bot_level = $1 WHERE id = $2", [level, id]);
}

// The chess-site names that count as "you" when reading a PGN.
function usernamesOf(user) {
  return [user.lichess_username, user.chesscom_username].filter(Boolean);
}

module.exports = {
  create,
  findByEmail,
  findById,
  updateUsernames,
  setUsername,
  usernamesOf,
  setBotLevel,
};
