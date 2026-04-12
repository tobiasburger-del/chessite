//this function is an authentication middleware, ensuring users who aren't logged in, cannot access protected pages.
function loginrequired(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
// if the user is logged in, next() ensures the connection to continue.
  next();
}

module.exports = loginrequired;
