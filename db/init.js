const Database = require('better-sqlite3');
const db = new Database('game.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS Game (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS Move (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER REFERENCES Game(id),
        move_number INTEGER,
        color TEXT,
        san TEXT,
        fen_after TEXT
    )
`);

module.exports = db;