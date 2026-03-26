const express = require('express');
const {first} = require('./utils/pgn-parser');
const db = require('./db/init');
const app = express();
const port = 3000; 


app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', './views');

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/games', (req, res) => {
    const games = db.prepare("SELECT * FROM Game").all();
    res.render('games', { games: games });
});

app.get('/games/:id', (req, res) => {
    const id = req.params.id;
    const game = db.prepare("SELECT * FROM Game WHERE id = ?").get(id);
    const moves = db.prepare("SELECT * FROM Move WHERE game_id = ?").all(id);
    res.render('game-detail', { game: game, moves: moves });
});

app.post('/games', (req, res) => {
    if (!req.body.pgn) {
        return res.redirect('/import');
    }
   const result = first(req.body.pgn);
   const exists = db.prepare("SELECT id FROM Game WHERE pgn_raw = ?").get(req.body.pgn);
   if (exists) {
    return res.redirect ('/import');
   }
   const moves = result.history;
   const game_insert = db.prepare(`INSERT INTO game (pgn_raw, white_player, black_player, result, date_played, white_elo, black_elo, site, opening) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(req.body.pgn, result.header.White, result.header.Black, result.header.Result, result.header.Date, result.header.WhiteElo, result.header.BlackElo, result.header.Site, result.header.Opening);
    const gameId = game_insert.lastInsertRowid;
    const move_insert = db.prepare(`INSERT INTO Move (game_id, move_number, color, san, fen_after) VALUES (?, ?, ?, ?, ?)`);
    moves.forEach((move, index) => {
        move_insert.run(gameId, Math.floor(index / 2)+1, index % 2 === 0 ? 'w' : 'b', move, null);
    });
    res.redirect('/games');
});

app.post('/games/:id/delete', (req, res) => {
    const id = req.params.id;
    const move = db.prepare("DELETE FROM Move WHERE game_id = ?").run(id);
    const game = db.prepare("DELETE FROM Game WHERE id = ?").run(id);
    res.redirect('/games')

});

app.post('/games/:id/edit', (req, res) => {
    const id = req.params.id;
    const notes = req.body.notes
    db.prepare("UPDATE Game SET notes = ? WHERE id = ?").run(notes, id)
    res.redirect('/games/'+id)
})

app.get('/import', (req, res) => {
    res.render('import');
});

app.listen(port, () => {
    console.log(`Server is running and listening on port ${port}`);
});