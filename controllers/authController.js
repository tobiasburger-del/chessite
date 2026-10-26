const bcrypt = require("bcrypt");
const User = require("../models/user");

function registerForm(req, res) {
  res.render("register", { userId: req.session.userId, error: null });
}

function loginForm(req, res) {
  res.render("login", { userId: req.session.userId, error: null });
}

async function register(req, res) {
  const { email, password } = req.body;
  const fail = (error) =>
    res.render("register", { error, userId: req.session.userId });

  if (!email || !password) return fail("You cannot leave the fields empty.");
  try {
    await User.create(email, await bcrypt.hash(password, 10));
  } catch (err) {
    if (err.code === "23505") return fail("Email already in use");
    throw err;
  }
  res.redirect("/login");
}

async function login(req, res) {
  const { email, password } = req.body;
  const fail = (error) =>
    res.render("login", { error, userId: req.session.userId });

  if (!email || !password) return fail("You cannot leave the fields empty.");
  const user = await User.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return fail("Wrong email or password.");
  }
  req.session.userId = user.id;
  res.redirect("/games");
}

function logout(req, res) {
  req.session.destroy(() => res.redirect("/login"));
}

module.exports = { registerForm, loginForm, register, login, logout };
