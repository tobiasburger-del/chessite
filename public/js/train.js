// Train page: solve one drill (a position where you went wrong in a game).
// "Analyze all" is handled by analysisQueue.js.
import { ARROW_TYPE } from "/vendor/cm-chessboard/src/extensions/arrows/Arrows.js";
import {
  createBoard,
  enablePlayerInput,
  showLastMove,
  clearHighlights,
} from "./boardUi.js";
import { createBatchEngine } from "./analysis.js";
import { formatScore } from "./gameAnalysis.js";

const { classifyMove } = globalThis.MoveClassifier;

const trainer = document.querySelector(".trainer");
if (trainer) initDrill(trainer, JSON.parse(trainer.dataset.drill));

function initDrill(root, drill) {
  const feedback = root.querySelector("#drill-feedback");
  const reveal = root.querySelector("#drill-reveal");
  const retryBtn = root.querySelector("#drill-retry");
  const nextBtn = root.querySelector("#drill-next");
  const giveUpBtn = root.querySelector("#drill-giveup");
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

  function say(text, cls = "") {
    feedback.textContent = text;
    feedback.className = `drill-feedback ${cls}`;
  }

  function startInput() {
    enablePlayerInput(board, { fen: () => drill.fen, color: drill.color, onMove });
  }

  async function onMove(move) {
    board.disableMoveInput();
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
    say(correct ? `✓ Correct. ${text}` : `✗ Not quite. ${text}`, correct ? "is-correct" : "is-wrong");
    showAnswer();
    retryBtn.hidden = correct;
    record(correct);
  }

  function showAnswer() {
    reveal.hidden = false;
    nextBtn.hidden = false;
    root.querySelector("#drill-play").hidden = false;
    giveUpBtn.hidden = true;
    board.removeArrows();
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
    board.setPosition(drill.fen, true);
    reveal.hidden = true;
    retryBtn.hidden = true;
    say("Try again. This attempt won't change your schedule.");
    startInput();
  });

  giveUpBtn.addEventListener("click", () => {
    board.disableMoveInput();
    say(`The move was ${drill.bestSan}.`, "is-wrong");
    showAnswer();
    retryBtn.hidden = false;
    record(false);
  });

  window.addEventListener("beforeunload", () => engine && engine.terminate());
  startInput();
}

function article(word) {
  return /^[aeiou]/.test(word) ? "an" : "a";
}

