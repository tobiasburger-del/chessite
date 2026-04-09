require('dotenv').config(); 

const { Pool } = require('pg')
const pool = new Pool ({connectionString: process.env.DATABASE_URL})

async function initDB() {
    await pool.query(`CREATE TABLE IF NOT EXISTS users(
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
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
        game_id INTEGER REFERENCES Game(id) ON DELETE CASCADE,
        move_number INTEGER,
        color TEXT,
        san TEXT,
        fen_after TEXT)
`);
}
initDB()

module.exports = pool