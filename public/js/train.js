// Train page: solve one drill (a position where you went wrong in a game).
// Every verdict lands in the coach box on the card, with the reason behind
// it. "Analyze all" is handled by analysisQueue.js.
import { Chess } from "/vendor/chess.js/chess.js";
import { ARROW_TYPE } from "/vendor/cm-chessboard/src/extensions/arrows/Arrows.js";
import {
  createBoard,
  enablePlayerInput,
  showLastMove,
  clearHighlights,
  showMoveBadge,
  clearMoveBadge,
  LABEL_SYMBOL,
} from "./boardUi.js";
import { createBatchEngine } from "./analysis.js";
import { formatScore } from "./gameAnalysis.js";

const { classifyMove } = globalThis.MoveClassifier;
const { explainLine, PIECE_NAMES } = globalThis.Explain;
// Deeper than game analysis: these lines are read move by move.
const WHY_DEPTH = 14;
const PIECE_HINT = { class: "marker-hint", slice: "markerSquare" };
const PIECE_GLYPHS = { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" };

const VERDICT = {
  best: "is the best move",
  good: "works too",
  inaccuracy: "is an inaccuracy",
  mistake: "is a mistake",
  blunder: "is a blunder",
};

const trainer = document.querySelector(".trainer");
if (trainer) initDrill(trainer, JSON.parse(trainer.dataset.drill));

function initDrill(root, drill) {
  const $ = (sel) => root.querySelector(sel);
  const retryBtn = $("#drill-retry");
  const hintBtn = $("#drill-hint");
  const playBestBtn = $("#drill-play-best");
  const nextBtn = $("#drill-next");
  const whyBtn = $("#drill-why-btn");
  const playLink = $("#drill-play");
  const whyPanel = $("#drill-why");
  const coachBox = $("#coach");

  // Which buttons each stage of the drill offers.
  const ACTIONS = {
    solving: [hintBtn],
    wrong: [retryBtn, hintBtn],
    solved: [nextBtn, whyBtn, playLink],
    revealed: [playBestBtn, nextBtn, whyBtn, playLink],
  };
  const allActions = [...new Set(Object.values(ACTIONS).flat())];
  function showActions(stage) {
    for (const el of allActions) el.hidden = !ACTIONS[stage].includes(el);
  }

  const board = createBoard($("#board"), {
    position: drill.fen,
    orientation: drill.color,
  });
  const bestFrom = drill.bestMove.slice(0, 2);
  const bestTo = drill.bestMove.slice(2, 4);
  const playedUci = uciOf(drill.fen, drill.playedSan);

  // Only the first attempt counts for spaced repetition.
  let recorded = false;
  // 0 = no hint, 1 = piece shown (no longer counts as solved), 2 = answer shown.
  let hintStep = 0;
  let showingStart = false;
  // After a wrong move the board shows it until you retry or take a hint.
  let awaitingRetry = false;

  // --- Engine reports: one per move tried, shared by the coach and "Show why".

  let engine = null;
  const analyze = (fen, go) => (engine ||= createBatchEngine()).analyze(fen, go);
  let scoreBefore = null;
  const reports = new Map();

  // uci → Promise<{ san, label, score, summary, plies }>.
  function report(uci) {
    if (!reports.has(uci)) reports.set(uci, buildReport(uci));
    return reports.get(uci);
  }

  async function buildReport(uci) {
    const move = new Chess(drill.fen).move(uciToMove(uci));
    scoreBefore ||= drill.evalBefore
      ? Promise.resolve(drill.evalBefore)
      : analyze(drill.fen).then((r) => r.score);
    const before = await scoreBefore;
    const { score, line } = await analyze(move.after, `depth ${WHY_DEPTH}`);
    // Your game move keeps the label it got in game analysis.
    const label =
      uci === drill.bestMove
        ? "best"
        : uci === playedUci
          ? drill.classification
          : classifyMove({ before, after: score, mover: drill.color, played: uci, best: drill.bestMove });
    const kind = isGood(label) ? "best" : "played";
    const { plies, summary } = explainLine(Chess, {
      fen: drill.fen,
      line: [uci, ...line],
      scoreAfter: score,
      scoreBefore: before,
      kind,
    });
    return { san: move.san, label, score, summary, plies };
  }

  // --- Coach box: one verdict at a time, filled in once the engine is done.

  const coachEl = {
    icon: coachBox.querySelector(".coach-icon"),
    move: coachBox.querySelector(".coach-move"),
    title: coachBox.querySelector(".coach-title-text"),
    score: coachBox.querySelector(".coach-score"),
    body: coachBox.querySelector(".coach-body"),
  };
  // Bumped on every new verdict, so a slow report can't overwrite a newer one.
  let coachId = 0;

  // tone: a move label or "hint"; details: { score, body } now or as a Promise.
  function coach({ tone, symbol, san = "", title, details }) {
    const id = ++coachId;
    coachBox.className = `coach cls-${tone}`;
    coachEl.icon.textContent = symbol;
    coachEl.move.textContent = san;
    coachEl.title.textContent = title;
    const fill = ({ score, body } = {}) => {
      if (id !== coachId) return;
      coachEl.score.textContent = score ? formatScore(score) : "";
      coachEl.score.hidden = !score;
      coachEl.body.textContent = body || "";
      coachEl.body.hidden = !body;
    };
    if (details instanceof Promise) {
      fill({ body: "Working out why…" });
      details.then(fill, () => fill());
    } else {
      fill(details);
    }
    return id;
  }

  function verdict(r, extra = "") {
    return {
      tone: r.label,
      symbol: LABEL_SYMBOL[r.label],
      san: r.san,
      title: VERDICT[r.label],
      details: { score: r.score, body: [r.summary, extra].filter(Boolean).join(" ") },
    };
  }

  // Your game move and why it went wrong.
  function coachGameMove() {
    const cls = drill.classification;
    coach({
      tone: cls,
      symbol: LABEL_SYMBOL[cls],
      san: drill.playedSan,
      title: `was ${article(cls)} ${cls} in your game`,
      details: playedUci
        ? report(playedUci).then((r) => ({ score: r.score, body: r.summary }))
        : { score: drill.evalAfter },
    });
  }

  function coachPieceHint() {
    const piece = new Chess(drill.fen).get(bestFrom).type;
    coach({
      tone: "hint",
      symbol: PIECE_GLYPHS[piece],
      title: `Move your ${PIECE_NAMES[piece]}`,
      details: { body: drill.ideaHint },
    });
  }

  // Whatever the card should say while you're (re)trying the position.
  function coachIdle() {
    if (hintStep >= 1) coachPieceHint();
    else coachGameMove();
  }

  // --- Board

  // Before you move: the opponent's last move, and your game move in red.
  function showStart() {
    showingStart = true;
    clearHighlights(board);
    board.removeArrows();
    board.removeMarkers(PIECE_HINT);
    if (drill.lastMove) showLastMove(board, drill.lastMove.from, drill.lastMove.to);
    if (drill.playedMove) {
      const { from, to } = drill.playedMove;
      board.addArrow(ARROW_TYPE.danger, from, to);
      showMoveBadge(board, to, drill.classification);
    }
    if (hintStep >= 1) board.addMarker(PIECE_HINT, bestFrom);
  }

  function clearStart() {
    showingStart = false;
    board.removeArrows();
    board.removeMarkers(PIECE_HINT);
    clearMoveBadge(board);
  }

  function startInput() {
    enablePlayerInput(board, { fen: () => drill.fen, color: drill.color, onMove });
  }

  function showBestArrow() {
    board.removeArrows();
    board.removeMarkers(PIECE_HINT);
    board.addArrow(ARROW_TYPE.success, bestFrom, bestTo);
  }

  // Back to the drill position for another try.
  function reset() {
    awaitingRetry = false;
    board.disableMoveInput();
    board.removeArrows();
    clearHighlights(board);
    board.setPosition(drill.fen, true).then(showStart);
    startInput();
    showActions("solving");
  }

  // --- Solving

  async function onMove(move) {
    board.disableMoveInput();
    clearStart();
    // Show the position after the move, including the promoted piece.
    board.setPosition(move.after, true);
    showLastMove(board, move.from, move.to);
    hintBtn.disabled = true;

    const id = coach({
      tone: "pending",
      symbol: "…",
      san: move.san,
      title: "",
      details: { body: "Checking your move…" },
    });
    const r = await report(move.from + move.to + (move.promotion || ""));
    hintBtn.disabled = false;
    if (id !== coachId) return;

    const correct = isGood(r.label);
    // Only the first try counts, and seeing the piece gives most of it away.
    record(correct && hintStep === 0);
    if (!correct) {
      coach(verdict(r));
      awaitingRetry = true;
      showActions("wrong");
      retryBtn.focus();
      return;
    }
    coach(verdict(r, r.label === "good" ? `The engine's move was ${drill.bestSan}.` : ""));
    showBestArrow();
    showActions("solved");
    nextBtn.focus();
  }

  async function record(correct) {
    if (recorded) return;
    recorded = true;
    await fetch(`/train/${drill.id}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correct }),
    });
  }

  retryBtn.addEventListener("click", () => {
    reset();
    coachIdle();
  });

  // Hint ladder: the piece to move, then the move itself.
  hintBtn.addEventListener("click", () => {
    if (awaitingRetry) reset();
    hintStep++;
    if (hintStep === 1) {
      board.addMarker(PIECE_HINT, bestFrom);
      hintBtn.textContent = "Show the move";
      coachPieceHint();
      return;
    }
    board.disableMoveInput();
    clearStart();
    record(false);
    coach({
      tone: "best",
      symbol: LABEL_SYMBOL.best,
      san: drill.bestSan,
      title: "was the move",
      details: report(drill.bestMove).then((r) => ({ score: r.score, body: r.summary })),
    });
    showBestArrow();
    showActions("revealed");
  });

  // Once the answer is shown, play it rather than make you drag it.
  playBestBtn.addEventListener("click", () => {
    const move = new Chess(drill.fen).move(uciToMove(drill.bestMove));
    board.removeArrows();
    board.setPosition(move.after, true);
    showLastMove(board, move.from, move.to);
    playBestBtn.hidden = true;
  });

  // --- "Show why": the engine's line after the best move and after your
  // game move, stepped through on the board.

  const why = { current: "best", plies: [], ply: -1 };
  if (!playedUci) whyPanel.querySelector('[data-line="played"]').hidden = true;

  function showPly(ply) {
    why.ply = Math.max(-1, Math.min(why.plies.length - 1, ply));
    board.removeArrows();
    clearHighlights(board);
    if (why.ply < 0) {
      board.setPosition(drill.fen, true);
    } else {
      const p = why.plies[why.ply];
      board.setPosition(p.fen, true);
      showLastMove(board, p.from, p.to);
    }
    whyPanel.querySelectorAll(".why-move").forEach((li, i) =>
      li.classList.toggle("is-current", i === why.ply));
  }

  async function showLine(kind) {
    why.current = kind;
    why.plies = [];
    whyPanel.querySelectorAll(".why-tab").forEach((t) => {
      const on = t.dataset.line === kind;
      t.classList.toggle("is-selected", on);
      t.setAttribute("aria-selected", String(on));
    });
    const summary = whyPanel.querySelector("#why-summary");
    const list = whyPanel.querySelector("#why-moves");
    summary.textContent = "Working it out…";
    list.replaceChildren();
    const { plies, summary: text } = await report(kind === "best" ? drill.bestMove : playedUci);
    if (why.current !== kind) return;
    why.plies = plies;
    summary.textContent = text;
    plies.forEach((p, i) => {
      const li = document.createElement("li");
      li.className = `why-move ${p.color === drill.color ? "is-yours" : ""}`;
      li.textContent = p.san;
      li.addEventListener("click", () => showPly(i));
      list.appendChild(li);
    });
    // Start on the move itself, so the board shows what it does.
    showPly(0);
  }

  whyBtn.addEventListener("click", () => {
    whyBtn.hidden = true;
    whyPanel.hidden = false;
    showLine("best");
  });
  whyPanel.querySelectorAll(".why-tab").forEach((t) =>
    t.addEventListener("click", () => showLine(t.dataset.line)));
  whyPanel.querySelector(".why-nav").addEventListener("click", (e) => {
    const step = e.target.closest("[data-step]")?.dataset.step;
    if (!step || !why.plies.length) return;
    if (step === "reset") {
      showPly(-1);
      board.addArrow(ARROW_TYPE.success, bestFrom, bestTo);
    } else {
      showPly(why.ply + (step === "next" ? 1 : -1));
    }
  });
  document.addEventListener("keydown", (e) => {
    if (whyPanel.hidden || !why.plies.length) return;
    if (e.key === "ArrowRight") showPly(why.ply + 1);
    else if (e.key === "ArrowLeft") showPly(why.ply - 1);
  });

  window.addEventListener("beforeunload", () => engine && engine.terminate());
  window.addEventListener("resize", () => {
    if (showingStart && drill.playedMove) {
      showMoveBadge(board, drill.playedMove.to, drill.classification);
    }
  });

  // The board draws asynchronously; the badge needs its squares in place.
  requestAnimationFrame(showStart);
  startInput();
  showActions("solving");
  coachGameMove();
}

function isGood(label) {
  return label === "best" || label === "good";
}

function uciToMove(uci) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

// SAN in `fen` → UCI, or null if it can't be replayed.
function uciOf(fen, san) {
  try {
    const m = new Chess(fen).move(san);
    return m.from + m.to + (m.promotion || "");
  } catch {
    return null;
  }
}

function article(word) {
  return /^[aeiou]/.test(word) ? "an" : "a";
}
