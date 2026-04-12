require("dotenv").config();
const session = require("express-session");
const bcrypt = require("bcrypt");
const loginrequired = require("./middleware/auth");
const express = require("express");
const { first } = require("./utils/pgn-parser");
const pool = require("./db/init");
const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", 1);

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  }),
);

app.set("view engine", "ejs");
app.set("views", "./views");

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index", { userId: req.session.userId });
});

app.get("/games", loginrequired, async (req, res) => {
  try {
    const userId = req.session.userId;
    const games = await pool.query("SELECT * FROM Game WHERE user_id = $1", [
      userId,
    ]);
    res.render("games", { games: games.rows, userId: req.session.userId });
  } catch (err) {
    console.error(err);
    res.status(500).send("That went wrong!");
  }
});

app.get("/games/:id", loginrequired, async (req, res) => {
  try {
    const id = req.params.id;
    const game = await pool.query("SELECT * FROM Game WHERE id = $1", [id]);
    const moves = await pool.query("SELECT * FROM Move WHERE game_id = $1", [
      id,
    ]);
    res.render("game-detail", {
      game: game.rows[0],
      moves: moves.rows,
      userId: req.session.userId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong");
  }
});

app.post("/games", loginrequired, async (req, res) => {
  try {
    const userId = req.session.userId;
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
      `INSERT INTO game (pgn_raw, white_player, black_player, result, date_played, white_elo, black_elo, site, opening, user_id) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
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
        userId,
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

app.post("/games/:id/delete", loginrequired, async (req, res) => {
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

app.post("/games/:id/edit", loginrequired, async (req, res) => {
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

app.get("/import", loginrequired, (req, res) => {
  res.render("import", { userId: req.session.userId });
});

app.get("/register", (req, res) => {
  res.render("register", { userId: req.session.userId, error: null });
});

app.get("/login", (req, res) => {
  res.render("login", { userId: req.session.userId, error: null });
});

app.post("/register", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    if (!email || !password) {
      return res.render("register", {
        error: "You cannot leave the fields empty.",
        userId: req.session.userId,
      });
    }
    const scramble = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (email, password_hash) VALUES($1, $2)",
      [email, scramble],
    );
    res.redirect("/login");
  } catch (err) {
    if (err.code === "23505") {
      return res.render("register", {
        error: "Email already in use",
        userId: req.session.userId,
      });
    } else {
      res.status(500).send("Something went wrong!");
    }
  }
});

app.post("/login", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    if (!email || !password) {
      return res.render("login", {
        error: "You cannot leave the fields empty.",
        userId: req.session.userId,
      });
    }
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];
    if (!user) {
      return res.redirect("/login");
    }
    const correct_password = await bcrypt.compare(password, user.password_hash);
    if (correct_password) {
      req.session.userId = user.id;
      res.redirect("/games");
    } else {
      res.redirect("/login");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});

app.post("/logout", (req, res) => {
  try {
    req.session.destroy();
    res.redirect("/register");
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong!");
  }
});

app.listen(port, () => {
  console.log(`Server is running and listening on port ${port}`);
});
