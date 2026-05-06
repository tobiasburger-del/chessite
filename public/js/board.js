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
import { createEngine } from "./analysis.js";

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

  const orientation =
    history[0] && history[0].color === "b" ? COLOR.black : COLOR.white;

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

  render(0);
}
