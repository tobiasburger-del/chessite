const express = require('express');
const {first} = require('./utils/pgn-parser');
const db = require('./db/init');
const app = express();
const port = 3000; 
app.use(express.urlencoded({ extended: true }));

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/games', (req, res) => {
    res.sendFile(__dirname + '/public/games.html');
    console.log(db.prepare("SELECT * FROM Game").all());
});

app.get('/games/:id', (req, res) => {
    const id= req.params.id;
        res.send ("Game detail for game " + id);
})

app.post('/games', (req, res) => {
   const result = first(req.body.pgn);
   db.prepare (`INSERT INTO game (pgn_raw, white_player, black_player, result, date_played, white_elo, black_elo, site, opening) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(req.body.pgn, result.header.White, result.header.Black, result.header.Result, result.header.Date, result.header.WhiteElo, result.header.BlackElo, result.header.Site, result.header.Opening);
   res.redirect('/games');
})

app.get('/import', (req, res) => {
    res.sendFile(__dirname + '/public/import.html');
});

app.listen(port, () => {
    console.log(`Server is running and listening on port ${port}`);
});