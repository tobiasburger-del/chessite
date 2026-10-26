import { Chess } from "/vendor/chess.js/chess.js";
import {
  Chessboard,
  COLOR,
  BORDER_TYPE,
} from "/vendor/cm-chessboard/src/Chessboard.js";
import {
  Arrows,
  ARROW_TYPE,
} from "/vendor/cm-chessboard/src/extensions/arrows/Arrows.js";
import {
  createEngine,
  createBatchEngine,
  GAME_ANALYSIS_DEPTH,
} from "./analysis.js";

const { classifyGame } = globalThis.MoveClassifier;

const LABEL_TEXT = {
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

const stage = document.querySelector(".analysis");
if (stage) {
  initBoard(stage);
}

function initBoard(root) {
  const pgn = root.dataset.pgn || "";
  const boardEl = root.querySelector("#board");
  const moveItems = Array.from(root.querySelectorAll(".move-list li"));
  const transportButtons = root.querySelectorAll(".tr-btn");
  const plyCurrent = root.querySelector("#ply-current");
  const plyTotal = root.querySelector("#ply-total");

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

  const board = new Chessboard(boardEl, {
    position: replay.fen(),
    orientation,
    assetsUrl: "/vendor/cm-chessboard/assets/",
    extensions: [
      { class: Arrows, props: { headSize: 8, offsetTo: 0.25 } },
    ],
    style: {
      cssClass: "bulletin",
      showCoordinates: true,
      borderType: BORDER_TYPE.thin,
      pieces: { file: "pieces/standard.svg", tileSize: 40 },
      animationDuration: 220,
    },
  });

  const evalWhite = root.querySelector("#eval-bar .eb-white");
  const evalBlack = root.querySelector("#eval-bar .eb-black");
  const evalReadout = root.querySelector("#eval-readout");
  const evalBar = root.querySelector("#eval-bar");
  if (evalBar && orientation === COLOR.black) evalBar.classList.add("is-flipped");

  const engine = createEngine();

  engine.onInfo((info) => {
    if (!info.score) return;
    paintEval(info.score);
  });

  engine.onBestmove((bm) => {
    if (typeof board.removeArrows === "function") board.removeArrows();
    if (typeof board.addArrow === "function") {
      board.addArrow(ARROW_TYPE.default, bm.from, bm.to);
    }
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
    if (typeof board.removeArrows === "function") board.removeArrows();
    if (evalReadout) evalReadout.textContent = "…";
  }

  window.addEventListener("beforeunload", () => engine.terminate());

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
    const fen = fenAtPly(clamped);
    board.setPosition(fen, true);
    clearEvalUI();
    engine.setPosition(fen);
    if (plyCurrent) plyCurrent.textContent = clamped;
    updateMoveNote(clamped);

    moveItems.forEach((li, idx) => {
      const isActive = idx + 1 === clamped;
      li.classList.toggle("is-active", isActive);
      if (isActive) {
        // Scroll only the move-list container, never the page. scrollIntoView
        // would chain up to the viewport and pull the board off-screen.
        const parent = li.parentElement;
        if (parent) {
          const target = li.offsetTop - parent.clientHeight / 2 + li.clientHeight / 2;
          parent.scrollTo({ top: target, behavior: "smooth" });
        }
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

  transportButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.dataset.nav;
      if (dir === "start") render(0);
      else if (dir === "prev") render(currentPly - 1);
      else if (dir === "next") render(currentPly + 1);
      else if (dir === "end") render(totalPly);
    });
  });

  moveItems.forEach((li) => {
    const ply = Number(li.dataset.ply);
    li.addEventListener("click", () => render(ply));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        render(ply);
      }
    });
  });

  // "14… Qxb2?? Blunder — best was Nf3 (+0.30 → −2.80)" under the board.
  const moveNote = root.querySelector("#move-note");
  const startEval = scoreFromData(root.dataset.startEval, "");

  function updateMoveNote(ply) {
    if (!moveNote) return;
    const li = moveItems[ply - 1];
    const label = li && LABEL_TEXT[li.dataset.classification];
    if (!label) {
      moveNote.textContent = "";
      moveNote.className = "move-note";
      return;
    }
    const m = history[ply - 1];
    const num = Math.floor((ply - 1) / 2) + 1 + (m.color === "w" ? "." : "…");
    const prev = moveItems[ply - 2];
    const before = prev
      ? scoreFromData(prev.dataset.evalCp, prev.dataset.evalMate)
      : startEval;
    const after = scoreFromData(li.dataset.evalCp, li.dataset.evalMate);
    const best = li.dataset.bestSan ? ` — best was ${li.dataset.bestSan}` : "";
    const evals =
      before && after ? ` (${formatScore(before)} → ${formatScore(after)})` : "";
    moveNote.textContent = `${num} ${m.san} ${label}${best}${evals}`;
    moveNote.className = `move-note cls-${li.dataset.classification}`;
  }

  // Whole-game analysis: evaluate every position, label every move, save.
  const analyzeBtn = root.querySelector("#analyze-btn");
  const progress = root.querySelector("#analyze-progress");
  if (analyzeBtn) analyzeBtn.addEventListener("click", runGameAnalysis);

  async function runGameAnalysis() {
    analyzeBtn.disabled = true;
    progress.hidden = false;
    const bar = progress.querySelector(".analyze-progress-bar span");
    const text = progress.querySelector(".analyze-progress-text");
    const showProgress = (done) => {
      bar.style.width = `${(100 * done) / (totalPly + 1)}%`;
      text.textContent = `Analyzing position ${done} / ${totalPly + 1}`;
    };

    const fens = [];
    const walk = new Chess();
    fens.push(walk.fen());
    for (const m of history) {
      walk.move({ from: m.from, to: m.to, promotion: m.promotion });
      fens.push(walk.fen());
    }

    const batch = createBatchEngine();
    const positions = [];
    try {
      showProgress(0);
      for (const fen of fens) {
        positions.push(await evaluate(batch, fen));
        showProgress(positions.length);
      }
    } finally {
      batch.terminate();
    }

    const played = history.map((m) => m.from + m.to + (m.promotion || ""));
    const labels = classifyGame(
      positions.map((p) => ({ score: p.score, best: p.bestUci })),
      played,
    );
    const payload = {
      depth: GAME_ANALYSIS_DEPTH,
      startEvalCp: positions[0].score.cp ?? null,
      moves: history.map((_, i) => ({
        fenAfter: fens[i + 1],
        evalCp: positions[i + 1].score.cp ?? null,
        evalMate: positions[i + 1].score.mate ?? null,
        bestMove: positions[i].bestUci,
        bestSan: positions[i].bestSan,
        classification: labels[i],
      })),
    };

    text.textContent = "Saving…";
    const res = await fetch(`/games/${root.dataset.gameId}/analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      text.textContent = "Could not save the analysis. Try again.";
      analyzeBtn.disabled = false;
    }
  }

  render(0);
}

// Game-over positions are scored directly; Stockfish has no move to search.
async function evaluate(batch, fen) {
  const pos = new Chess(fen);
  if (pos.isCheckmate()) {
    return { score: { mate: pos.turn() === "w" ? -1 : 1 }, bestUci: null, bestSan: null };
  }
  if (pos.isGameOver()) return { score: { cp: 0 }, bestUci: null, bestSan: null };

  const { score, best } = await batch.analyze(fen);
  if (!best) return { score, bestUci: null, bestSan: null };
  const bestSan = pos.move({ from: best.from, to: best.to, promotion: best.promotion || undefined }).san;
  return { score, bestUci: best.from + best.to + (best.promotion || ""), bestSan };
}

function scoreFromData(cp, mate) {
  if (mate !== undefined && mate !== "") return { mate: Number(mate) };
  if (cp !== undefined && cp !== "") return { cp: Number(cp) };
  return null;
}

function formatScore(score) {
  if (score.mate != null) return `${score.mate >= 0 ? "+" : "−"}M${Math.abs(score.mate)}`;
  return (score.cp >= 0 ? "+" : "−") + Math.abs(score.cp / 100).toFixed(2);
}
