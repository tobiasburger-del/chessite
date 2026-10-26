require("dotenv").config({ quiet: true });
const express = require("express");
const session = require("express-session");
const { initDB } = require("./config/db");
const pageRoutes = require("./routes/pageRoutes");
const authRoutes = require("./routes/authRoutes");
const gameRoutes = require("./routes/gameRoutes");
const importRoutes = require("./routes/importRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const analysisRoutes = require("./routes/analysisRoutes");
const trainRoutes = require("./routes/trainRoutes");
const playRoutes = require("./routes/playRoutes");
const insightsRoutes = require("./routes/insightsRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", "./views");
app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  }),
);
app.use(express.static("public"));
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

app.use(pageRoutes);
app.use(authRoutes);
app.use(gameRoutes);
app.use(importRoutes);
app.use(settingsRoutes);
app.use(analysisRoutes);
app.use(trainRoutes);
app.use(playRoutes);
app.use(insightsRoutes);
app.use(errorHandler);

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running and listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Could not initialise the database:", err.message);
    process.exit(1);
  });
