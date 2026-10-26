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

module.exports = { create, findByEmail };
