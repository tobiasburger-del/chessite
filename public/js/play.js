// Play page: a real game against a Stockfish bot. In "weak spot" mode the bot
// replays your opponent's moves from an old game, leading you back to a
// position where you went wrong. Finished games are saved, analyzed, and your
// move at that position counts as a drill attempt.
import { Chess } from "/vendor/chess.js/chess.js";
import {
  createBoard,
  enablePlayerInput,
  showLastMove,
  showCheck,
  clearHighlights,
} from "./boardUi.js";
import { createBatchEngine, BOT_LEVELS } from "./analysis.js";
import { analyzeGame, saveAnalysis, historyFromPgn } from "./gameAnalysis.js";

// Plies replayed from the old game before you take over (3 moves each).
const WARMUP_PLIES = 6;
const MIN_BOT_DELAY_MS = 450;

const root = document.querySelector(".play");
if (root) initPlay(root, JSON.parse(root.dataset.play));

function initPlay(root, config) {
  const $ = (sel) => root.querySelector(sel);
  const status = $("#play-status");
  const focus = config.focus;
  let selectedLevel = config.recommendedLevel;

  renderLevelPicker();

  const board = createBoard($("#board"), { position: new Chess().fen() });

  let game, userColor, startPly, engine, level, source, following, over;

  const startBtn = $("#play-start");
  if (startBtn) startBtn.addEventListener("click", start);
  $("#play-resign").addEventListener("click", () => {
    if (!over && confirm("Resign this game?")) {
      finish(userColor === "w" ? "0-1" : "1-0", "You resigned");
    }
  });
  window.addEventListener("beforeunload", () => engine && engine.terminate());

  function renderLevelPicker() {
    const picker = $("#level-picker");
    if (!picker) return;
    for (const lvl of BOT_LEVELS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "level-btn";
      btn.dataset.level = lvl.level;
      btn.innerHTML = `<span class="level-name">${lvl.name}</span>` +
        `<span class="level-sub mono">${lvl.elo ? "~" + lvl.elo : "L" + lvl.level}</span>`;
      if (lvl.level === config.recommendedLevel) btn.classList.add("is-recommended");
      btn.addEventListener("click", () => {
        selectedLevel = lvl.level;
        picker.querySelectorAll(".level-btn").forEach((b) =>
          b.classList.toggle("is-selected", Number(b.dataset.level) === selectedLevel));
      });
      picker.appendChild(btn);
    }
    picker.querySelector(`[data-level="${selectedLevel}"]`)?.classList.add("is-selected");
  }

  function start() {
    level = BOT_LEVELS.find((l) => l.level === selectedLevel) || BOT_LEVELS[2];
    engine = createBatchEngine({ setup: level.setup });
    game = new Chess();
    over = false;

    if (focus) {
      source = historyFromPgn(focus.pgn);
      startPly = Math.max(0, focus.ply - 1 - WARMUP_PLIES);
      for (let i = 0; i < startPly; i++) game.move(source[i].san);
      userColor = focus.color;
      following = true;
    } else {
      const picked = root.querySelector("input[name=color]:checked")?.value || "w";
      userColor = picked === "random" ? (Math.random() < 0.5 ? "w" : "b") : picked;
      startPly = 0;
      following = false;
    }

    $("#play-setup").hidden = true;
    $("#play-game").hidden = false;
    $("#play-meta").textContent =
      `You play ${userColor === "w" ? "White" : "Black"} · Bot: ${level.name}`;
    board.setOrientation(userColor);
    board.setPosition(game.fen(), false);
    clearHighlights(board);
    nextTurn();
  }

  function nextTurn() {
    renderMoves();
    if (game.isGameOver()) return finish(...gameOverResult());
    if (game.turn() === userColor) {
      say("Your move");
      enablePlayerInput(board, { fen: () => game.fen(), color: userColor, onMove });
    } else {
      botMove();
    }
  }

  function onMove({ from, to, promotion }) {
    board.disableMoveInput();
    const ply = game.history().length;
    const move = game.move({ from, to, promotion });
    // Leave the old game as soon as you play something different.
    if (following && (!source[ply] || source[ply].san !== move.san)) following = false;
    afterMove(move);
  }

  async function botMove() {
    say("Bot is thinking…");
    const startedAt = Date.now();
    const ply = game.history().length;
    let move;
    // Replay the old opponent's move until the critical position is passed.
    if (following && source[ply] && ply < focus.ply) {
      move = { from: source[ply].from, to: source[ply].to, promotion: source[ply].promotion };
    } else {
      following = false;
      const { best } = await engine.analyze(game.fen(), level.go);
      move = { from: best.from, to: best.to, promotion: best.promotion || undefined };
    }
    const wait = MIN_BOT_DELAY_MS - (Date.now() - startedAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (over) return;
    afterMove(game.move(move));
  }

  function afterMove(move) {
    board.setPosition(game.fen(), true);
    showLastMove(board, move.from, move.to);
    showCheck(board, game.fen());
    nextTurn();
  }

  function gameOverResult() {
    if (game.isCheckmate()) {
      return game.turn() === "w" ? ["0-1", "Checkmate"] : ["1-0", "Checkmate"];
    }
    if (game.isStalemate()) return ["1/2-1/2", "Stalemate"];
    if (game.isThreefoldRepetition()) return ["1/2-1/2", "Threefold repetition"];
    if (game.isInsufficientMaterial()) return ["1/2-1/2", "Insufficient material"];
    return ["1/2-1/2", "Draw"];
  }

  function renderMoves() {
    const list = $("#play-moves");
    const history = game.history();
    list.innerHTML = "";
    for (let i = 0; i < history.length; i += 2) {
      const li = document.createElement("li");
      li.className = i + 1 < startPly ? "is-replayed" : "";
      li.textContent = `${i / 2 + 1}. ${history[i]} ${history[i + 1] || ""}`;
      list.appendChild(li);
    }
    list.scrollTop = list.scrollHeight;
  }

  function say(text) {
    status.textContent = text;
  }

  async function finish(result, reason) {
    if (over) return;
    over = true;
    board.disableMoveInput();
    engine.terminate();

    const won = (result === "1-0") === (userColor === "w");
    const title = result === "1/2-1/2" ? "Draw" : won ? "You won" : "You lost";
    say(`${title} · ${reason}`);
    $("#play-game").hidden = true;
    $("#play-summary").hidden = false;
    $("#summary-title").textContent = `${title}.`;
    const list = $("#summary-list");
    const note = (text, cls = "") => {
      const li = document.createElement("li");
      li.textContent = text;
      if (cls) li.className = cls;
      list.appendChild(li);
    };
    note(reason);

    if (game.history().length - startPly < 2) {
      note("Too short to save.");
      return showActions();
    }

    const botName = `Bot · ${level.name}`;
    game.setHeader("Event", focus ? "Weak-spot practice" : "Practice game");
    game.setHeader("Site", "Chess Companion");
    game.setHeader("Date", new Date().toISOString().slice(0, 10).replace(/-/g, "."));
    game.setHeader("White", userColor === "w" ? "You" : botName);
    game.setHeader("Black", userColor === "b" ? "You" : botName);
    game.setHeader("Result", result);

    const res = await fetch("/play/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pgn: game.pgn(),
        userColor,
        startPly,
        level: level.level,
        drillId: focus ? focus.drillId : null,
      }),
    });
    if (!res.ok) {
      note("Could not save the game.", "is-wrong");
      return showActions();
    }
    const saved = await res.json();
    $("#summary-review").href = `/games/${saved.id}`;
    if (saved.level !== level.level) {
      const next = BOT_LEVELS.find((l) => l.level === saved.level);
      note(`Next time the bot plays at ${next.name} (${saved.level > level.level ? "stronger" : "easier"}).`);
    }

    // Analyze so your new mistakes become drills.
    const bar = root.querySelector("#summary-progress .analyze-progress-bar span");
    const text = root.querySelector("#summary-progress .analyze-progress-text");
    const history = game.history({ verbose: true });
    const payload = await analyzeGame(history, (done, total) => {
      bar.style.width = `${(100 * done) / total}%`;
      text.textContent = `Analyzing your game · ${done} / ${total}`;
    });
    const analysis = await saveAnalysis(saved.id, payload);
    $("#summary-progress").hidden = true;

    if (focus) await reportCriticalMoment(history, payload, note);
    if (analysis) {
      note(analysis.drills === 0
        ? "No new mistakes to drill from this game."
        : `${analysis.drills} position${analysis.drills === 1 ? "" : "s"} from this game added to your drills.`);
    }
    showActions();
  }

  // Did you reach the position you once got wrong, and what did you play?
  async function reportCriticalMoment(history, payload, note) {
    const i = focus.ply - 1;
    const sameSpot = history[i] && samePosition(history[i].before, focus.fen);
    if (!sameSpot) {
      note("You left your old game before the critical position, so it wasn't tested this time.");
      return;
    }
    const label = payload.moves[i].classification;
    const correct = label === "best" || label === "good";
    const played = history[i].san;
    note(
      correct
        ? `✓ At the critical moment you played ${played}. Mistake fixed.`
        : `✗ At the critical moment you played ${played} (${label}). It stays in your drills.`,
      correct ? "is-correct" : "is-wrong",
    );
    await fetch(`/train/${focus.drillId}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correct }),
    });
  }

  function showActions() {
    $("#summary-actions").hidden = false;
  }
}

// Compares piece placement, side to move, castling and en passant.
function samePosition(fenA, fenB) {
  const key = (fen) => fen.split(" ").slice(0, 4).join(" ");
  return key(fenA) === key(fenB);
}
