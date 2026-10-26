const express = require("express");
const auth = require("../controllers/authController");

const router = express.Router();

router.get("/register", auth.registerForm);
router.post("/register", auth.register);
router.get("/login", auth.loginForm);
router.post("/login", auth.login);
router.post("/logout", auth.logout);

module.exports = router;
