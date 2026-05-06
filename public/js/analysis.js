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
