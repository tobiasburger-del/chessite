require("dotenv").config();
const session = require("express-session");
const bcrypt = require("bcrypt");
const express = require("express");
const { first } = require("./utils/pgn-parser");
const pool = require("./db/init");
const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret : process.env.SESSION_SECRET,
    resave : false,
    saveUninitialized: false,
    cookie : {secure: process.env.NODE_ENV === 'production'},
}))

app.set("view engine", "ejs");
app.set("views", "./views");

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/games", async (req, res) => {
  try {
    const games = await pool.query("SELECT * FROM Game");
    res.render("games", { games: games.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("That went wrong!");
  }
});

app.get("/games/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const game = await pool.query("SELECT * FROM Game WHERE id = $1", [id]);
    const moves = await pool.query("SELECT * FROM Move WHERE game_id = $1", [
      id,
    ]);
    res.render("game-detail", { game: game.rows[0], moves: moves.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong");
  }
});

app.post("/games", async (req, res) => {
  try {
    if (!req.body.pgn) {
      return res.redirect("/import");
    }
    const result = first(req.body.pgn);
    const exists = await pool.query("SELECT id FROM Game WHERE pgn_raw = $1", [
      req.body.pgn,
    ]);
    if (exists.rows[0]) {
      return res.redirect("/import");
    }
    const moves = result.history;
    const game_insert = await pool.query(
      `INSERT INTO game (pgn_raw, white_player, black_player, result, date_played, white_elo, black_elo, site, opening) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        req.body.pgn,
        result.header.White,
        result.header.Black,
        result.header.Result,
        result.header.Date,
        result.header.WhiteElo,
        result.header.BlackElo,
        result.header.Site,
        result.header.Opening,
      ],
    );
    const gameId = game_insert.rows[0].id;
    for (const [index, move] of moves.entries()) {
      await pool.query(
        `INSERT INTO move (game_id, move_number, color, san, fen_after) VALUES ($1, $2, $3, $4, $5)`,
        [
          gameId,
          Math.floor(index / 2) + 1,
          index % 2 === 0 ? "w" : "b",
          move,
          null,
        ],
      );
    }
    res.redirect("/games");
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});

app.post("/games/:id/delete", async (req, res) => {
  try {
    const id = req.params.id;
    const move = await pool.query("DELETE FROM Move WHERE game_id = $1", [id]);
    const game = await pool.query("DELETE FROM Game WHERE id = $1", [id]);
    res.redirect("/games");
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});

app.post("/games/:id/edit", async (req, res) => {
  try {
    const id = req.params.id;
    const notes = req.body.notes;
    await pool.query("UPDATE Game SET notes = $1 WHERE id = $2", [notes, id]);
    res.redirect("/games/" + id);
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});

app.get("/import", (req, res) => {
  res.render("import");
});

app.get("/register", (req, res) => {
    res.render("register")
})

app.get("/login", (req, res) => {
    res.render("login")
})

app.post("/register", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    const scramble = await bcrypt.hash(password, 10)
    await pool.query("INSERT INTO users (email, password_hash) VALUES($1, $2)", [email, scramble]);
    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});

app.post("/login", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
     if (!user) {
       return res.redirect("/login");
    }
    const correct_password = await bcrypt.compare(password, user.password_hash);
    if (correct_password) {
        req.session.userId= user.id;
        res.redirect("/");
    }
    else {
        res.redirect("/login")
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});

app.listen(port, () => {
  console.log(`Server is running and listening on port ${port}`);
});
