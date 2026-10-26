// Train page: solve one drill (a position where you went wrong in a game).
// "Analyze all" is handled by analysisQueue.js.
import { ARROW_TYPE } from "/vendor/cm-chessboard/src/extensions/arrows/Arrows.js";
import {
  createBoard,
  enablePlayerInput,
  showLastMove,
  clearHighlights,
  showMoveBadge,
  clearMoveBadge,
} from "./boardUi.js";
import { createBatchEngine } from "./analysis.js";
import { formatScore } from "./gameAnalysis.js";

const { classifyMove } = globalThis.MoveClassifier;
const PIECE_HINT = { class: "marker-hint", slice: "markerSquare" };

const trainer = document.querySelector(".trainer");
if (trainer) initDrill(trainer, JSON.parse(trainer.dataset.drill));

function initDrill(root, drill) {
  const feedback = root.querySelector("#drill-feedback");
  const reveal = root.querySelector("#drill-reveal");
  const retryBtn = root.querySelector("#drill-retry");
  const nextBtn = root.querySelector("#drill-next");
  const hintBtn = root.querySelector("#drill-hint");
  const hintText = root.querySelector("#drill-hint-text");
  const evals = root.querySelector("#drill-evals");
  if (evals && drill.evalBefore && drill.evalAfter) {
    evals.textContent = `(${formatScore(drill.evalBefore)} → ${formatScore(drill.evalAfter)})`;
  }

  const board = createBoard(root.querySelector("#board"), {
    position: drill.fen,
    orientation: drill.color,
  });

  // Only the first attempt counts for spaced repetition.
  let recorded = false;
  let engine = null;
  // 0 = no hint yet, 1 = idea shown, 2 = piece shown (no longer counts as solved).
  let hintStep = 0;
  let showingStart = false;

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
    if (hintStep >= 2) board.addMarker(PIECE_HINT, drill.bestMove.slice(0, 2));
  }

  function clearStart() {
    showingStart = false;
    board.removeArrows();
    board.removeMarkers(PIECE_HINT);
    clearMoveBadge(board);
  }

  function say(text, cls = "") {
    feedback.textContent = text;
    feedback.className = `drill-feedback ${cls}`;
  }

  function startInput() {
    enablePlayerInput(board, { fen: () => drill.fen, color: drill.color, onMove });
  }

  async function onMove(move) {
    board.disableMoveInput();
    clearStart();
    // Show the position after the move, including the promoted piece.
    board.setPosition(move.after, true);
    showLastMove(board, move.from, move.to);
    const uci = move.from + move.to + (move.promotion || "");

    if (uci === drill.bestMove) return finish(true, `${move.san} is the engine's move.`);
    if (move.san === drill.playedSan) {
      return finish(false, `${move.san} is what you played in the game.`);
    }

    say("Checking your move…");
    engine = engine || createBatchEngine();
    const before = drill.evalBefore || (await engine.analyze(drill.fen)).score;
    const { score: after } = await engine.analyze(move.after);
    const label = classifyMove({
      before,
      after,
      mover: drill.color,
      played: uci,
      best: drill.bestMove,
    });
    if (label === "best" || label === "good") {
      finish(true, `${move.san} works too (${formatScore(after)}).`);
    } else {
      finish(false, `${move.san} is ${article(label)} ${label} (${formatScore(after)}).`);
    }
  }

  function finish(correct, text) {
    const withHelp = correct && hintStep >= 2;
    const head = withHelp ? "✓ Correct, with a hint." : correct ? "✓ Correct." : "✗ Not quite.";
    say(`${head} ${text}`, correct ? "is-correct" : "is-wrong");
    showAnswer();
    retryBtn.hidden = correct;
    // Seeing the piece gives most of it away, so it doesn't count as solved.
    record(correct && !withHelp);
  }

  function showAnswer() {
    reveal.hidden = false;
    nextBtn.hidden = false;
    root.querySelector("#drill-play").hidden = false;
    hintBtn.hidden = true;
    board.removeArrows();
    board.removeMarkers(PIECE_HINT);
    board.addArrow(ARROW_TYPE.success, drill.bestMove.slice(0, 2), drill.bestMove.slice(2, 4));
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
    board.removeArrows();
    clearHighlights(board);
    board.setPosition(drill.fen, true).then(showStart);
    reveal.hidden = true;
    retryBtn.hidden = true;
    say("Try again. This attempt won't change your schedule.");
    startInput();
  });

  // Hint ladder: the idea, then the piece to move, then the answer.
  hintBtn.addEventListener("click", () => {
    hintStep++;
    if (hintStep === 1) {
      hintText.textContent = drill.ideaHint;
      hintText.hidden = false;
      hintBtn.textContent = "Show the piece";
    } else if (hintStep === 2) {
      board.addMarker(PIECE_HINT, drill.bestMove.slice(0, 2));
      hintText.textContent = `${drill.ideaHint} Move the highlighted piece.`;
      hintBtn.textContent = "Show answer";
    } else {
      board.disableMoveInput();
      clearStart();
      say(`The move was ${drill.bestSan}.`, "is-wrong");
      showAnswer();
      retryBtn.hidden = false;
      record(false);
    }
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
}

function article(word) {
  return /^[aeiou]/.test(word) ? "an" : "a";
}

