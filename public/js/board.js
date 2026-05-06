import { Chess } from "/vendor/chess.js/chess.js";
import {
  Chessboard,
  COLOR,
  BORDER_TYPE,
} from "/vendor/cm-chessboard/src/Chessboard.js";

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
    style: {
      cssClass: "bulletin",
      showCoordinates: true,
      borderType: BORDER_TYPE.thin,
      pieces: { file: "pieces/standard.svg", tileSize: 40 },
      animationDuration: 220,
    },
  });

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
    board.setPosition(fenAtPly(clamped), true);
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
