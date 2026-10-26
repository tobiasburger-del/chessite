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

// The chess-site names that count as "you" when reading a PGN.
function usernamesOf(user) {
  return [user.lichess_username, user.chesscom_username].filter(Boolean);
}

module.exports = { create, findByEmail, findById, updateUsernames, usernamesOf };
