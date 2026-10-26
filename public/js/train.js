// Train page: solve one drill (a position where you went wrong in a game),
// and run the "Analyze all" queue that turns games into drills.
import { Chess } from "/vendor/chess.js/chess.js";
import {
  Chessboard,
  COLOR,
  BORDER_TYPE,
  INPUT_EVENT_TYPE,
} from "/vendor/cm-chessboard/src/Chessboard.js";
import {
  Arrows,
  ARROW_TYPE,
} from "/vendor/cm-chessboard/src/extensions/arrows/Arrows.js";
import { createBatchEngine } from "./analysis.js";
import {
  analyzeGame,
  saveAnalysis,
  historyFromPgn,
  formatScore,
} from "./gameAnalysis.js";

const { classifyMove } = globalThis.MoveClassifier;

const trainer = document.querySelector(".trainer");
if (trainer) initDrill(trainer, JSON.parse(trainer.dataset.drill));

const analyzeAll = document.querySelector("#analyze-all");
if (analyzeAll) analyzeAll.addEventListener("click", runQueue);

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

  const board = new Chessboard(root.querySelector("#board"), {
    position: drill.fen,
    orientation: drill.color === "b" ? COLOR.black : COLOR.white,
    assetsUrl: "/vendor/cm-chessboard/assets/",
    extensions: [{ class: Arrows, props: { headSize: 8, offsetTo: 0.25 } }],
    style: {
      cssClass: "bulletin",
      showCoordinates: true,
      borderType: BORDER_TYPE.thin,
      pieces: { file: "pieces/standard.svg", tileSize: 40 },
      animationDuration: 220,
    },
  });

  // Only the first attempt counts for spaced repetition.
  let recorded = false;
  let engine = null;

  function say(text, cls = "") {
    feedback.textContent = text;
    feedback.className = `drill-feedback ${cls}`;
  }

  function legalMove(from, to) {
    try {
      return new Chess(drill.fen).move({ from, to, promotion: "q" });
    } catch (_) {
      return null;
    }
  }

  function startInput() {
    board.enableMoveInput((event) => {
      if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
        const piece = event.piece || "";
        return piece.startsWith(drill.color);
      }
      if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
        return Boolean(legalMove(event.squareFrom, event.squareTo));
      }
      if (event.type === INPUT_EVENT_TYPE.moveInputFinished && event.legalMove) {
        onMove(legalMove(event.squareFrom, event.squareTo));
      }
      return true;
    }, drill.color === "b" ? COLOR.black : COLOR.white);
  }

  async function onMove(move) {
    board.disableMoveInput();
    // Show the position after the move, including promotions to a queen.
    board.setPosition(move.after, true);
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

// Analyzes every unanalyzed game in turn; each one is saved as it finishes,
// so leaving the page keeps the progress made so far.
async function runQueue() {
  const progress = document.querySelector("#queue-progress");
  const bar = progress.querySelector(".analyze-progress-bar span");
  const text = progress.querySelector(".analyze-progress-text");
  analyzeAll.disabled = true;
  progress.hidden = false;
  text.textContent = "Loading games…";

  const games = await (await fetch("/train/queue")).json();
  let failed = 0;
  for (const [i, game] of games.entries()) {
    let history;
    try {
      history = historyFromPgn(game.pgn);
    } catch (_) {
      failed++;
      continue;
    }
    const payload = await analyzeGame(history, (done, total) => {
      bar.style.width = `${(100 * (i + done / total)) / games.length}%`;
      text.textContent = `Game ${i + 1} of ${games.length} · position ${done} / ${total}`;
    });
    if (!(await saveAnalysis(game.id, payload))) failed++;
  }
  text.textContent = failed ? `Done. ${failed} game(s) could not be analyzed.` : "Done.";
  window.location.reload();
}
