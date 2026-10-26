// Chess-site usernames: letters, digits, _ and - (Lichess and Chess.com rules).
const USERNAME = /^[A-Za-z0-9_-]{2,30}$/;

function isValidUsername(name) {
  return USERNAME.test(name);
}

module.exports = { isValidUsername };
