const chess = require('chess.js');
function first(PGN_string) {
    const chessInstance = new chess.Chess();
    chessInstance.loadPgn(PGN_string);
     return { header : chessInstance.header(), history: chessInstance.history() }
};

module.exports = { first }