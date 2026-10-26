// Express 5 forwards rejected promises from async handlers here.
function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).send("Something went wrong!");
}

module.exports = errorHandler;
