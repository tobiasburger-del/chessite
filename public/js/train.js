// Train page: solve one drill (a position where you went wrong in a game).
// "Analyze all" is handled by analysisQueue.js.
import { Chess } from "/vendor/chess.js/chess.js";
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
  const playBestBtn = root.querySelector("#drill-play-best");
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
  let tries = 0;
  // After a wrong move the board shows it until you retry or take a hint.
  let awaitingRetry = false;

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
    tries++;
    // Only the first try counts, and seeing the piece gives most of it away.
    record(correct && hintStep < 2);
    if (!correct) {
      say(`✗ Not quite. ${text} Try again, or take a hint.`, "is-wrong");
      awaitingRetry = true;
      retryBtn.hidden = false;
      return;
    }
    const head =
      tries > 1 ? `✓ Got it on try ${tries}.` : hintStep >= 2 ? "✓ Correct, with a hint." : "✓ Correct.";
    say(`${head} ${text}`, "is-correct");
    showAnswer();
    retryBtn.hidden = true;
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

  // Back to the drill position for another try.
  function reset() {
    awaitingRetry = false;
    board.disableMoveInput();
    board.removeArrows();
    clearHighlights(board);
    board.setPosition(drill.fen, true).then(showStart);
    retryBtn.hidden = true;
    startInput();
  }

  // Retrying only makes sense while the answer is hidden.
  retryBtn.addEventListener("click", () => {
    reset();
    say("Try again. Only your first try counts for your schedule.");
  });

  // Once the answer is shown, play it rather than make you drag it.
  playBestBtn.addEventListener("click", () => {
    const { from, to, promotion } = uciToMove(drill.bestMove);
    const move = new Chess(drill.fen).move({ from, to, promotion });
    board.removeArrows();
    board.setPosition(move.after, true);
    showLastMove(board, from, to);
    playBestBtn.hidden = true;
  });

  // Hint ladder: the idea, then the piece to move, then the answer.
  hintBtn.addEventListener("click", () => {
    if (awaitingRetry) {
      reset();
      say("");
    }
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
      retryBtn.hidden = true;
      playBestBtn.hidden = false;
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

function uciToMove(uci) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

function article(word) {
  return /^[aeiou]/.test(word) ? "an" : "a";
}

