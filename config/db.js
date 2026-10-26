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

  // Step 3: your own mistakes as spaced-repetition drills. One drill per
  // mistaken move; fen is the position before it (you to move).
  await pool.query(`CREATE TABLE IF NOT EXISTS drill(
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        game_id INTEGER NOT NULL REFERENCES game(id) ON DELETE CASCADE,
        move_id INTEGER NOT NULL UNIQUE REFERENCES move(id) ON DELETE CASCADE,
        fen TEXT NOT NULL,
        played_san TEXT,
        best_move TEXT NOT NULL,
        best_san TEXT,
        classification TEXT,
        eval_before_cp INTEGER,
        eval_before_mate INTEGER,
        eval_after_cp INTEGER,
        eval_after_mate INTEGER,
        box INTEGER NOT NULL DEFAULT 0,
        due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        attempts INTEGER NOT NULL DEFAULT 0,
        successes INTEGER NOT NULL DEFAULT 0,
        last_result BOOLEAN,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS drill_user_due ON drill(user_id, due_at)",
  );

  // Step 4: bot games. start_ply = moves copied from an earlier game before
  // play began (they never become drills); bot_level adapts to your results.
  await pool.query(
    "ALTER TABLE game ADD COLUMN IF NOT EXISTS start_ply INTEGER NOT NULL DEFAULT 0",
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_level INTEGER NOT NULL DEFAULT 3",
  );
  await pool.query(
    "ALTER TABLE drill ADD COLUMN IF NOT EXISTS last_played_at TIMESTAMPTZ",
  );
}

module.exports = { pool, initDB };
