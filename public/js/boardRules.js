// Chess rules the board UI needs: where a piece can go, whether a move
// promotes, and which king is in check. Takes a chess.js instance. Loaded as a
// classic script in the browser (globalThis.BoardRules) and as a CommonJS
// module in Jest, like moveClassifier.js.

(function (root) {
  // One entry per target square; the four promotion moves count as one.
  function legalTargets(chess, square) {
    const targets = new Map();
    for (const move of chess.moves({ square, verbose: true })) {
      targets.set(move.to, { to: move.to, capture: Boolean(move.captured) });
    }
    return Array.from(targets.values());
  }

  function isPromotion(chess, from, to) {
    return chess
      .moves({ square: from, verbose: true })
      .some((move) => move.to === to && Boolean(move.promotion));
  }

  // Square of the side-to-move's king when it is in check, else null.
  function checkedKingSquare(chess) {
    if (!chess.inCheck()) return null;
    const color = chess.turn();
    for (const row of chess.board()) {
      for (const piece of row) {
        if (piece && piece.type === "k" && piece.color === color) return piece.square;
      }
    }
    return null;
  }

  const api = { legalTargets, isPromotion, checkedKingSquare };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.BoardRules = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
