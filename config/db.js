require("dotenv").config({ quiet: true });

const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDB() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users(
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS game(
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pgn_raw TEXT,
        white_player TEXT,
        black_player TEXT,
        result TEXT,
        date_played TEXT,
        white_elo INTEGER,
        black_elo INTEGER,
        site TEXT,
        notes TEXT,
        opening TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
    `);
  await pool.query(`CREATE TABLE IF NOT EXISTS move(
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES game(id) ON DELETE CASCADE,
        move_number INTEGER,
        color TEXT,
        san TEXT,
        fen_after TEXT)
`);

  // Step 1: which accounts are "you", and which side you played.
  await pool.query(`ALTER TABLE users
        ADD COLUMN IF NOT EXISTS lichess_username TEXT,
        ADD COLUMN IF NOT EXISTS chesscom_username TEXT`);
  await pool.query(`ALTER TABLE game
        ADD COLUMN IF NOT EXISTS user_color TEXT,
        ADD COLUMN IF NOT EXISTS source_url TEXT`);

  // Step 2: per-move engine analysis (evals are White's point of view,
  // best_move is the engine choice in the position before the move).
  await pool.query(`ALTER TABLE move
        ADD COLUMN IF NOT EXISTS eval_cp INTEGER,
        ADD COLUMN IF NOT EXISTS eval_mate INTEGER,
        ADD COLUMN IF NOT EXISTS best_move TEXT,
        ADD COLUMN IF NOT EXISTS best_san TEXT,
        ADD COLUMN IF NOT EXISTS classification TEXT`);
  await pool.query(`ALTER TABLE game
        ADD COLUMN IF NOT EXISTS start_eval_cp INTEGER,
        ADD COLUMN IF NOT EXISTS analysis_depth INTEGER,
        ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP`);
}

module.exports = { pool, initDB };
