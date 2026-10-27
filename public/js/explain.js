// Turns an engine line into something you can read: the moves in SAN, the
// positions to step through, and one sentence on what the line does (mate,
// material won or lost, or where the eval ends up). Loaded as a classic
// script in the browser (globalThis.Explain) and as a CommonJS module in
// Jest, like moveClassifier.js. Takes chess.js's Chess class as an argument.

(function (root) {
  const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" };
  // Long enough to see a tactic through, short enough to follow.
  const MAX_PLIES = 6;

  // fen + UCI moves → [{ san, from, to, fen }], stopping at the first bad move.
  function playLine(Chess, fen, uciMoves) {
    const chess = new Chess(fen);
    const plies = [];
    for (const uci of uciMoves.slice(0, MAX_PLIES)) {
      let move;
      try {
        move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      } catch {
        break;
      }
      plies.push({ san: move.san, from: move.from, to: move.to, captured: move.captured, color: move.color, fen: chess.fen() });
    }
    return plies;
  }

  // ["q"] vs ["r"] → "the queen for a rook"; ["n", "p"] vs ["p"] → "a knight".
  function describeTrade(won, lost) {
    const a = [...won];
    const b = [...lost];
    for (let i = a.length - 1; i >= 0; i--) {
      const j = b.indexOf(a[i]);
      if (j >= 0) {
        a.splice(i, 1);
        b.splice(j, 1);
      }
    }
    const top = (list) => list.sort((x, y) => VALUES[y] - VALUES[x])[0];
    const name = (p) => (p === "q" ? "the queen" : `a ${NAMES[p]}`);
    const gain = top(a);
    if (!gain) return null;
    const give = top(b);
    return give ? `${name(gain)} for ${name(give)}` : name(gain);
  }

  // Net material for `color` over the line: what it took, what it gave up.
  function material(plies, color) {
    const won = [];
    const lost = [];
    for (const p of plies) {
      if (!p.captured) continue;
      (p.color === color ? won : lost).push(p.captured);
    }
    const sum = (list) => list.reduce((s, x) => s + VALUES[x], 0);
    return { won, lost, net: sum(won) - sum(lost) };
  }

  function pawns(cp) {
    const v = cp / 100;
    return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
  }

  // fen: position before the move; line: UCI, first move is the one being
  // explained; scoreAfter: White-POV eval after that first move; kind: "best"
  // or "played" (changes the wording, not the facts).
  function explainLine(Chess, { fen, line, scoreAfter, kind = "best" }) {
    const plies = playLine(Chess, fen, line);
    if (plies.length === 0) return { plies, summary: "" };
    const mover = plies[0].color;
    const sign = mover === "w" ? 1 : -1;
    const first = plies[0].san;
    const reply = plies[1] ? ` after ${plies[1].san}` : "";

    if (scoreAfter && scoreAfter.mate != null) {
      const youMate = sign * scoreAfter.mate > 0;
      const n = Math.abs(scoreAfter.mate);
      if (youMate) return { plies, summary: `${first} forces mate in ${n + 1}.` };
      return { plies, summary: `${first} allows mate in ${n}${reply}.` };
    }

    const { won, lost, net } = material(plies, mover);
    if (net >= 1) {
      const what = describeTrade(won, lost);
      if (what) return { plies, summary: `${first} wins ${what}.` };
    }
    if (net <= -1) {
      const what = describeTrade(lost, won);
      // Name the capture that takes the most, not whatever the reply was.
      const take = plies
        .filter((p) => p.color !== mover && p.captured)
        .sort((x, y) => VALUES[y.captured] - VALUES[x.captured])[0];
      if (what) return { plies, summary: `${first} loses ${what}${take ? ` to ${take.san}` : ""}.` };
    }

    if (!scoreAfter || scoreAfter.cp == null) return { plies, summary: "" };
    const cp = sign * scoreAfter.cp;
    const ev = `(${pawns(cp)})`;
    let text;
    if (cp >= 200) text = kind === "best" ? `keeps a winning position ${ev}` : `still leaves you winning ${ev}`;
    else if (cp >= 70) text = kind === "best" ? `keeps the advantage ${ev}` : `leaves you only slightly better ${ev}`;
    else if (cp > -70) text = kind === "best" ? `keeps the balance ${ev}` : `lets the position level out ${ev}`;
    else if (cp > -200) text = `leaves you worse ${ev}`;
    else text = `leaves you losing ${ev}`;
    return { plies, summary: `${first} ${text}.` };
  }

  const api = { MAX_PLIES, playLine, describeTrade, explainLine };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.Explain = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
