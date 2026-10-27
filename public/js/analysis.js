// Stockfish engine glue. Spawns the vendored single-threaded WASM build in a
// Web Worker, debounces position changes, and emits progressive evals.
//
// Pure UCI parsers live in /js/uci-parsers.js (loaded as a classic script
// before this module) so they can also be require()'d from Jest tests.

export const ANALYSIS_DEPTH = 16;
const DEBOUNCE_MS = 75;
const STOCKFISH_URL = "/vendor/stockfish/stockfish-18-lite-single.js";

const { parseInfoLine, parseBestmove, fenSideToMove, toWhitePov } =
  globalThis.UciParsers;

// Whole-game analysis and bot play: a second worker that searches positions
// one at a time, so it never interferes with the live eval above.
export const GAME_ANALYSIS_DEPTH = 12;

// Bot strengths. The weaker levels limit Stockfish's skill and depth; the
// stronger ones use its built-in Elo limit (its minimum is 1320).
export const BOT_LEVELS = [
  { level: 1, name: "Beginner", setup: ["setoption name Skill Level value 0"], go: "depth 1" },
  { level: 2, name: "Casual", setup: ["setoption name Skill Level value 3"], go: "depth 3" },
  { level: 3, name: "Club", setup: ["setoption name Skill Level value 6"], go: "depth 6" },
  { level: 4, name: "Advanced", elo: 1600, setup: ["setoption name UCI_LimitStrength value true", "setoption name UCI_Elo value 1600"], go: "movetime 500" },
  { level: 5, name: "Expert", elo: 1900, setup: ["setoption name UCI_LimitStrength value true", "setoption name UCI_Elo value 1900"], go: "movetime 700" },
  { level: 6, name: "Master", elo: 2300, setup: ["setoption name UCI_LimitStrength value true", "setoption name UCI_Elo value 2300"], go: "movetime 900" },
];

// setup: extra UCI commands sent once before the first search.
export function createBatchEngine({ setup = [] } = {}) {
  const worker = new Worker(STOCKFISH_URL);
  let onLine = null;
  const ready = new Promise((resolve) => {
    onLine = (line) => {
      if (line === "uciok") {
        setup.forEach((cmd) => worker.postMessage(cmd));
        worker.postMessage("isready");
      } else if (line === "readyok") resolve();
    };
  });
  worker.onmessage = (e) => {
    if (typeof e.data === "string" && onLine) onLine(e.data);
  };
  worker.postMessage("uci");

  function search(fen, go) {
    const sideToMove = fenSideToMove(fen);
    return new Promise((resolve) => {
      let score = null;
      let pv = [];
      onLine = (line) => {
        if (line.startsWith("info ")) {
          const info = parseInfoLine(line);
          if (info) score = info.score;
          if (info && info.pv) pv = info.pv;
        } else if (line.startsWith("bestmove")) {
          resolve({
            score: toWhitePov(score || { cp: 0 }, sideToMove),
            best: parseBestmove(line),
            line: pv,
          });
        }
      };
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go ${go}`);
    });
  }

  // The worker runs one search at a time, so overlapping calls queue up.
  let queue = ready;

  return {
    // Resolves { score (White POV), best: { from, to, promotion } | null,
    // line: the engine's main line as UCI moves }.
    analyze(fen, go = `depth ${GAME_ANALYSIS_DEPTH}`) {
      const result = queue.then(() => search(fen, go));
      queue = result.catch(() => {});
      return result;
    },
    terminate() {
      try {
        worker.terminate();
      } catch (_) {}
    },
  };
}

export function createEngine() {
  const worker = new Worker(STOCKFISH_URL);
  let infoCb = null;
  let bestmoveCb = null;
  let currentSideToMove = "w";
  let pendingFen = null;
  let debounceTimer = null;
  let ready = false;
  const queue = [];

  // goCount and bestmoveCount let us discard info lines that belong to a
  // search the user has already navigated past. UCI is FIFO: all infos for
  // search N arrive before bestmove for search N. So if (goCount -
  // bestmoveCount) > 1, info lines belong to a stale search and are dropped.
  let goCount = 0;
  let bestmoveCount = 0;

  function send(cmd) {
    if (ready) worker.postMessage(cmd);
    else queue.push(cmd);
  }

  worker.onmessage = (e) => {
    const line = typeof e.data === "string" ? e.data : "";
    if (!line) return;

    if (line === "uciok") {
      worker.postMessage("isready");
      return;
    }
    if (line === "readyok") {
      ready = true;
      while (queue.length) worker.postMessage(queue.shift());
      return;
    }

    if (line.startsWith("info ")) {
      if (goCount - bestmoveCount !== 1) return;
      const info = parseInfoLine(line);
      if (info && infoCb) {
        infoCb({
          depth: info.depth,
          score: toWhitePov(info.score, currentSideToMove),
          pv: info.pv,
        });
      }
      return;
    }

    if (line.startsWith("bestmove")) {
      const isLatest = goCount === bestmoveCount + 1;
      bestmoveCount++;
      if (!isLatest) return;
      const bm = parseBestmove(line);
      if (bm && bestmoveCb) bestmoveCb(bm);
      return;
    }
  };

  worker.postMessage("uci");

  function flush() {
    if (pendingFen == null) return;
    const fen = pendingFen;
    pendingFen = null;
    currentSideToMove = fenSideToMove(fen);
    send("stop");
    send(`position fen ${fen}`);
    send(`go depth ${ANALYSIS_DEPTH}`);
    goCount++;
  }

  return {
    setPosition(fen) {
      pendingFen = fen;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flush, DEBOUNCE_MS);
    },
    onInfo(cb) {
      infoCb = cb;
    },
    onBestmove(cb) {
      bestmoveCb = cb;
    },
    stop() {
      send("stop");
    },
    terminate() {
      clearTimeout(debounceTimer);
      try {
        worker.postMessage("quit");
      } catch (_) {}
      try {
        worker.terminate();
      } catch (_) {}
    },
  };
}
