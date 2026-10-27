// Game review: step through the game, live engine eval, and (once analyzed)
// labels on every move, an eval graph, what went wrong with your errors, and
// a jump to your next one.
import { Chess } from "/vendor/chess.js/chess.js";
import { COLOR } from "/vendor/cm-chessboard/src/Chessboard.js";
import { ARROW_TYPE } from "/vendor/cm-chessboard/src/extensions/arrows/Arrows.js";
import {
  createBoard,
  showLastMove,
  showCheck,
  clearHighlights,
  showMoveBadge,
  clearMoveBadge,
  LABEL_SYMBOL,
} from "./boardUi.js";
import { createEngine } from "./analysis.js";
import { analyzeGame, saveAnalysis } from "./gameAnalysis.js";
import { renderEvalGraph } from "./evalGraph.js";

const { winChance } = globalThis.MoveClassifier;

const LABEL_TEXT = {
  best: "Best move",
  good: "Good move",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};
const ERRORS = new Set(["inaccuracy", "mistake", "blunder"]);

const stage = document.querySelector(".analysis");
if (stage) {
  initBoard(stage);
}

function initBoard(root) {
  const pgn = root.dataset.pgn || "";
  const boardEl = root.querySelector("#board");
  // cells[ply - 1] is the move-table button for that ply.
  const cells = Array.from(root.querySelectorAll(".move-cell[data-ply]"));
  const moveTable = root.querySelector(".move-table");
  const transportButtons = root.querySelectorAll(".tr-btn");
  const plyCurrent = root.querySelector("#ply-current");
  const plyTotal = root.querySelector("#ply-total");
  const note = root.querySelector("#move-note");
  const nextErrorBtn = root.querySelector("#next-error");

  const replay = new Chess();
  let history = [];
  try {
    if (pgn.trim()) {
      const parsed = new Chess();
      parsed.loadPgn(pgn);
      history = parsed.history({ verbose: true });
    }
  } catch (e) {
    console.warn("Could not parse PGN; starting from initial position.", e);
    history = [];
  }

  const totalPly = history.length;
  if (plyTotal) plyTotal.textContent = totalPly;

  // Show the board from your side (set from your usernames or the side picker).
  const orientation =
    root.dataset.orientation === "b" ? COLOR.black : COLOR.white;

  const board = createBoard(boardEl, { position: replay.fen(), orientation });

  const evalWhite = root.querySelector("#eval-bar .eb-white");
  const evalBlack = root.querySelector("#eval-bar .eb-black");
  const evalReadout = root.querySelector("#eval-readout");
  const evalBar = root.querySelector("#eval-bar");
  if (evalBar && orientation === COLOR.black) evalBar.classList.add("is-flipped");

  const engine = createEngine();
  // While "Show best move" is on, the board shows the position before your
  // move and the live engine stays out of it.
  let previewing = false;

  engine.onInfo((info) => {
    if (!info.score || previewing) return;
    paintEval(info.score);
  });

  engine.onBestmove((bm) => {
    if (previewing) return;
    board.removeArrows();
    board.addArrow(ARROW_TYPE.default, bm.from, bm.to);
  });

  function paintEval(score) {
    let pct = 50;
    let label = "+0.00";
    if (score.mate != null) {
      const sign = score.mate >= 0 ? "+" : "−";
      label = `${sign}M${Math.abs(score.mate)}`;
      pct = score.mate > 0 ? 99 : score.mate < 0 ? 1 : 50;
    } else if (score.cp != null) {
      const cp = score.cp;
      label = (cp >= 0 ? "+" : "−") + Math.abs(cp / 100).toFixed(2);
      // tanh sigmoid: ±400cp ≈ ±38%, saturates smoothly past ±1000cp.
      pct = 50 + 50 * Math.tanh(cp / 400);
      pct = Math.max(2, Math.min(98, pct));
    }
    if (evalWhite) evalWhite.style.height = `${pct}%`;
    if (evalBlack) evalBlack.style.height = `${100 - pct}%`;
    if (evalReadout) evalReadout.textContent = label;
  }

  function clearEvalUI() {
    board.removeArrows();
    if (evalReadout) evalReadout.textContent = "…";
  }

  window.addEventListener("beforeunload", () => engine.terminate());

  // Saved analysis, read from the move table.
  const startEval = scoreFromData(root.dataset.startEval, "");
  const scoreAt = (ply) =>
    ply === 0
      ? startEval
      : scoreFromData(cells[ply - 1]?.dataset.evalCp, cells[ply - 1]?.dataset.evalMate);
  const isYourError = (cell) =>
    Boolean(cell.dataset.mine && !cell.dataset.replayed && ERRORS.has(cell.dataset.classification));
  const errorPlies = cells.filter(isYourError).map((c) => Number(c.dataset.ply));

  const graphEl = root.querySelector("#eval-graph");
  const graph =
    graphEl && totalPly > 0
      ? renderEvalGraph(graphEl, {
          scores: Array.from({ length: totalPly + 1 }, (_, i) => scoreAt(i)),
          marks: errorPlies.map((ply) => ({
            ply,
            classification: cells[ply - 1].dataset.classification,
          })),
          flip: orientation === COLOR.black,
          onSelect: (ply) => render(ply),
        })
      : null;

  const analyzed = cells.some((c) => c.dataset.classification);
  const knowsYourSide = cells.some((c) => c.dataset.mine);
  if (nextErrorBtn && analyzed && knowsYourSide) {
    nextErrorBtn.hidden = false;
    nextErrorBtn.addEventListener("click", () => {
      const next = errorPlies.find((p) => p > currentPly);
      if (next) render(next);
    });
  }

  let currentPly = 0;

  function fenAtPly(ply) {
    replay.reset();
    for (let i = 0; i < ply; i++) {
      const m = history[i];
      replay.move({ from: m.from, to: m.to, promotion: m.promotion });
    }
    return replay.fen();
  }

  function render(ply) {
    const clamped = Math.max(0, Math.min(ply, totalPly));
    currentPly = clamped;
    previewing = false;
    const fen = fenAtPly(clamped);
    board.setPosition(fen, true);
    clearHighlights(board);
    if (clamped > 0) showLastMove(board, history[clamped - 1].from, history[clamped - 1].to);
    showCheck(board, fen);
    showBadge();
    clearEvalUI();
    engine.setPosition(fen);
    if (plyCurrent) plyCurrent.textContent = clamped;
    updateNote(clamped);
    updateNextError();
    if (graph) graph.setCurrent(clamped);

    cells.forEach((cell, idx) => {
      const isActive = idx + 1 === clamped;
      cell.classList.toggle("is-active", isActive);
      if (isActive && moveTable) {
        // Scroll only the move table, never the page. scrollIntoView would
        // chain up to the viewport and pull the board off-screen.
        const row = cell.closest(".move-row");
        const target = row.offsetTop - moveTable.clientHeight / 2 + row.clientHeight / 2;
        moveTable.scrollTo({ top: target, behavior: "smooth" });
      }
    });

    transportButtons.forEach((btn) => {
      const dir = btn.dataset.nav;
      const atStart = clamped === 0;
      const atEnd = clamped === totalPly;
      btn.disabled =
        (dir === "start" || dir === "prev") ? atStart :
        (dir === "end" || dir === "next") ? atEnd : false;
    });
  }

  function showBadge() {
    const cell = cells[currentPly - 1];
    const cls = cell && cell.dataset.classification;
    if (cls && !previewing) {
      showMoveBadge(board, history[currentPly - 1].to, cls, {
        muted: Boolean(cell.dataset.replayed),
      });
    } else {
      clearMoveBadge(board);
    }
  }
  window.addEventListener("resize", showBadge);

  function updateNextError() {
    if (!nextErrorBtn || nextErrorBtn.hidden) return;
    const next = errorPlies.find((p) => p > currentPly);
    nextErrorBtn.disabled = !next;
    nextErrorBtn.textContent = errorPlies.length === 0
      ? "No errors"
      : next ? "Next error ▶" : "No more errors";
  }

  // How many win-% points the mover gave away with the move at `ply`.
  function winDrop(ply) {
    const before = scoreAt(ply - 1);
    const after = scoreAt(ply);
    if (!before || !after) return null;
    const sign = history[ply - 1].color === "w" ? 1 : -1;
    return Math.max(0, Math.round(sign * (winChance(before) - winChance(after))));
  }

  // "You played Nf3?? — best was Qxd5. You dropped 34% winning chances."
  function updateNote(ply) {
    if (!note) return;
    note.replaceChildren();
    note.className = "move-note";
    const cell = cells[ply - 1];
    const cls = cell && cell.dataset.classification;
    if (!cls) return;
    note.classList.add(`cls-${cls}`);
    const m = history[ply - 1];
    // With a comment, it says what was better; "best was X" is only a fallback.
    const comment = cell.dataset.comment;
    const best = comment ? null : cell.dataset.bestSan;
    const commentLine = () => {
      const p = document.createElement("p");
      p.className = "move-comment";
      p.textContent = comment;
      return p;
    };

    if (isYourError(cell)) {
      const drop = winDrop(ply);
      const text = document.createElement("p");
      text.textContent =
        `You played ${m.san}${LABEL_SYMBOL[cls]}` +
        (best ? ` — best was ${best}.` : ".") +
        (drop != null ? ` You dropped ${drop}% winning chances.` : "");
      const actions = document.createElement("div");
      actions.className = "move-note-actions";
      if (cell.dataset.bestMove) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-link";
        btn.textContent = "Show best move";
        btn.addEventListener("click", () => togglePreview(ply, btn));
        actions.appendChild(btn);
      }
      if (cell.dataset.drillId) {
        const link = document.createElement("a");
        link.href = `/train?drill=${cell.dataset.drillId}`;
        link.textContent = "Train this position →";
        actions.appendChild(link);
      }
      note.append(text);
      if (comment) note.append(commentLine());
      note.append(actions);
      return;
    }

    const num = Math.floor((ply - 1) / 2) + 1 + (m.color === "w" ? "." : "…");
    const text = document.createElement("p");
    text.textContent =
      `${num} ${m.san} ${LABEL_SYMBOL[cls]} ${LABEL_TEXT[cls]}` +
      (ERRORS.has(cls) && best ? ` — best was ${best}` : "") +
      (cell.dataset.replayed ? " · replayed from your old game" : "");
    note.appendChild(text);
    if (comment) note.append(commentLine());
  }

  // Shows the position before your move with the best move drawn in.
  function togglePreview(ply, btn) {
    if (previewing) return render(ply);
    previewing = true;
    const uci = cells[ply - 1].dataset.bestMove;
    board.setPosition(fenAtPly(ply - 1), true);
    clearHighlights(board);
    clearMoveBadge(board);
    board.removeArrows();
    board.addArrow(ARROW_TYPE.secondary, uci.slice(0, 2), uci.slice(2, 4));
    btn.textContent = "Back to your move";
  }

  transportButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.dataset.nav;
      if (dir === "start") render(0);
      else if (dir === "prev") render(currentPly - 1);
      else if (dir === "next") render(currentPly + 1);
      else if (dir === "end") render(totalPly);
    });
  });

  cells.forEach((cell) => {
    cell.addEventListener("click", () => render(Number(cell.dataset.ply)));
  });

  // ← / → step through the game (not while typing notes).
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof Element && e.target.closest("textarea, input, select")) return;
    if (e.key === "ArrowLeft") render(currentPly - 1);
    else if (e.key === "ArrowRight") render(currentPly + 1);
    else return;
    e.preventDefault();
  });

  // Whole-game analysis: evaluate every position, label every move, save.
  const analyzeBtn = root.querySelector("#analyze-btn");
  const progress = root.querySelector("#analyze-progress");
  if (analyzeBtn) analyzeBtn.addEventListener("click", runGameAnalysis);

  async function runGameAnalysis() {
    analyzeBtn.disabled = true;
    progress.hidden = false;
    const bar = progress.querySelector(".analyze-progress-bar span");
    const text = progress.querySelector(".analyze-progress-text");

    const payload = await analyzeGame(history, (done, total) => {
      bar.style.width = `${(100 * done) / total}%`;
      text.textContent = `Analyzing position ${done} / ${total}`;
    });

    text.textContent = "Saving…";
    if (await saveAnalysis(root.dataset.gameId, payload)) {
      window.location.reload();
    } else {
      text.textContent = "Could not save the analysis. Try again.";
      analyzeBtn.disabled = false;
    }
  }

  // /games/:id?ply=12 opens at that move (used by the Train page).
  const startPly = Number(new URLSearchParams(window.location.search).get("ply"));
  render(Number.isInteger(startPly) ? startPly : 0);
}

function scoreFromData(cp, mate) {
  if (mate !== undefined && mate !== "") return { mate: Number(mate) };
  if (cp !== undefined && cp !== "") return { cp: Number(cp) };
  return null;
}
