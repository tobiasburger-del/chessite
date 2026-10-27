// Turns an engine line into something you can read: the moves in SAN, the
// positions to step through, and one sentence on what the line does (mate,
// material won or lost, or where the eval ends up). Loaded as a classic
// script in the browser (globalThis.Explain) and as a CommonJS module in
// Jest, like moveClassifier.js. Takes chess.js's Chess class as an argument.

(function (root) {
  const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
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
  // Pieces of equal value cancel out (a knight for a bishop is a trade).
  function describeTrade(won, lost) {
    const a = [...won];
    const b = [...lost];
    for (let i = a.length - 1; i >= 0; i--) {
      const j = b.findIndex((x) => VALUES[x] === VALUES[a[i]]);
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
  // next: the engine's move right after these plies (the line was cut
  // short). If it recaptures on the last capture's square, that capture is
  // half an exchange and isn't counted.
  function material(plies, color, next) {
    const won = [];
    const lost = [];
    const last = plies[plies.length - 1];
    const recaptured = plies.length > 1 && last.captured && next && next.slice(2, 4) === last.to;
    const counted = recaptured ? plies.slice(0, -1) : plies;
    for (const p of counted) {
      if (!p.captured) continue;
      (p.color === color ? won : lost).push(p.captured);
    }
    const sum = (list) => list.reduce((s, x) => s + VALUES[x], 0);
    return { won, lost, net: sum(won) - sum(lost) };
  }

  // Mover's-side centipawns, with mates as ±1000 (the classifier's cap).
  function moverCp(score, sign) {
    if (!score) return null;
    if (score.mate != null) return sign * score.mate > 0 ? 1000 : -1000;
    return Math.max(-1000, Math.min(1000, sign * score.cp));
  }

  function pawns(cp) {
    const v = Math.round(cp / 10) / 10;
    return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
  }

  // fen: position before the move; line: UCI, first move is the one being
  // explained; scoreAfter: White-POV eval after that first move; kind: "best"
  // or "played" (changes the wording, not the facts). scoreBefore (optional,
  // played only): the eval before the move, so a material loss is only named
  // when the eval drop backs it up.
  function explainLine(Chess, { fen, line, scoreAfter, scoreBefore, kind = "best" }) {
    const plies = playLine(Chess, fen, line);
    if (plies.length === 0) return { plies, summary: "" };
    const mover = plies[0].color;
    const sign = mover === "w" ? 1 : -1;
    const first = plies[0].san;
    const reply = plies[1] ? ` after ${plies[1].san}` : "";

    if (first.endsWith("#")) return { plies, summary: `${first} is checkmate.` };
    if (scoreAfter && scoreAfter.mate != null) {
      const youMate = sign * scoreAfter.mate > 0;
      const n = Math.abs(scoreAfter.mate);
      if (youMate) return { plies, summary: `${first} forces mate in ${n + 1}.` };
      return { plies, summary: `${first} allows mate in ${n}${reply}.` };
    }

    // A short line only shows part of the story, so the eval has the last
    // word: the best move never "loses" material, your error never "wins" it.
    const { won, lost, net } = material(plies, mover, line[plies.length]);
    if (kind === "best" && net >= 1) {
      const what = describeTrade(won, lost);
      if (what) return { plies, summary: `${first} wins ${what}.` };
    }
    const before = moverCp(scoreBefore, sign);
    const after = moverCp(scoreAfter, sign);
    const dropBacksIt = before == null || after == null || before - after >= 50 * Math.min(-net, 6);
    if (kind === "played" && net <= -1 && dropBacksIt) {
      const what = describeTrade(lost, won);
      // Name the capture that takes the most, not whatever the reply was.
      const take = plies
        .filter((p) => p.color !== mover && p.captured)
        .sort((x, y) => VALUES[y.captured] - VALUES[x.captured])[0];
      // A pawn can be the visible part of a much bigger drop: say both.
      const worse = after != null && before != null && before - after >= 100 * -net + 150 && after <= -70;
      const tail = worse ? ` and leaves you ${after <= -200 ? "losing" : "worse"} (${pawns(after)})` : "";
      if (what) return { plies, summary: `${first} loses ${what}${take ? ` to ${take.san}` : ""}${tail}.` };
    }

    if (!scoreAfter || scoreAfter.cp == null) return { plies, summary: "" };
    const cp = sign * scoreAfter.cp;
    const ev = `(${pawns(cp)})`;
    const edge = kind === "played" && lostEdge(scoreBefore, before, cp, sign);
    let text;
    if (edge) {
      const shift = edge === "a forced mate" ? ev : `(${pawns(before)} → ${pawns(cp)})`;
      const worse = cp <= -70 ? ` and leaves you ${cp <= -200 ? "losing" : "worse"}` : "";
      text = `throws away ${edge}${worse} ${shift}`;
    } else if (cp >= 200) text = kind === "best" ? `keeps a winning position ${ev}` : `still leaves you winning ${ev}`;
    else if (cp >= 70) text = kind === "best" ? `keeps the advantage ${ev}` : `leaves you only slightly better ${ev}`;
    else if (cp > -70) text = kind === "best" ? `keeps the balance ${ev}` : `lets the position level out ${ev}`;
    else if (cp > -200) text = `leaves you worse ${ev}`;
    else text = `leaves you losing ${ev}`;
    return { plies, summary: `${first} ${text}.` };
  }

  // What a played move gave up, when the eval drop says it gave something up:
  // "a forced mate", "a winning position", "your advantage", or null.
  // before/after: mover's-side centipawns (moverCp).
  function lostEdge(scoreBefore, before, after, sign) {
    if (before == null || before - after < 100) return null;
    if (scoreBefore.mate != null && sign * scoreBefore.mate > 0) return "a forced mate";
    if (before >= 200 && after < 200) return "a winning position";
    if (before >= 70 && after < 70) return "your advantage";
    return null;
  }

  // One line for a move in game review: what it does, and what was better.
  // fen: position before the move. played/bestMove: UCI. playedLine: the
  // engine line after your move; bestLine: the line from the position before
  // it (starts with the best move). scoreAfter/scoreBefore: White-POV evals
  // after your move / before it. Returns null for the best move.
  function commentFor(Chess, { fen, played, bestMove, playedLine, bestLine, scoreAfter, scoreBefore, classification }) {
    if (classification === "best" || !bestMove || played === bestMove) return null;
    const line = bestLine && bestLine[0] === bestMove ? bestLine : [bestMove];
    const best = playLine(Chess, fen, line.slice(0, 1))[0];
    if (!best) return null;
    const sign = best.color === "w" ? 1 : -1;

    if (classification === "good") {
      const ev = scoreBefore && scoreBefore.cp != null ? ` (${pawns(sign * scoreBefore.cp)})` : "";
      return `Fine. ${best.san} was a touch more precise${ev}.`;
    }

    const yours = explainLine(Chess, {
      fen,
      line: [played, ...(playedLine || [])],
      scoreAfter,
      scoreBefore,
      kind: "played",
    }).summary;
    const better = explainLine(Chess, { fen, line, scoreAfter: afterBest(scoreBefore, sign), kind: "best" }).summary;
    return [yours, better && `Better: ${better}`].filter(Boolean).join(" ") || null;
  }

  // The eval before a move, as explainLine wants it: after the best move.
  // A mate in n for the mover is a mate in n-1 once it's played; the rest
  // (cp, or the opponent's mate) carries over.
  function afterBest(score, sign) {
    if (!score || score.mate == null || sign * score.mate <= 0) return score;
    return { mate: score.mate - sign };
  }

  const api = { MAX_PLIES, PIECE_NAMES: NAMES, playLine, describeTrade, explainLine, commentFor };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.Explain = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
