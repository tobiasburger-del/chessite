// "Analyze all" that keeps going while you move around the site. Loaded on
// every logged-in page from the navbar. The queue's state lives in
// localStorage (per user), so the next page picks it up again; the game that
// was being analyzed starts over. Only one tab works on it at a time.
import { analyzeGame, saveAnalysis, historyFromPgn } from "./gameAnalysis.js";

const status = document.querySelector("#queue-status");
const userId = status && status.dataset.userId;
const KEY = `analysisQueue:${userId}`;
const LOCK = `analysisQueueLock:${userId}`;
const TAB = tabId();
const HEARTBEAT_MS = 3000;
const STALE_MS = 10000;
// The bot needs the CPU; analysis waits until you leave the Play page.
const PAUSED_HERE = location.pathname.startsWith("/play");
// Pages that list analysis results reload once the queue is done (Train only
// while it has no drill on screen, so it never interrupts one).
const RELOAD_WHEN_DONE =
  ["/", "/games"].includes(location.pathname) ||
  (location.pathname === "/train" && !document.querySelector(".trainer"));

let running = false;
let heartbeat = null;

// Same id for every page in this browser tab, so moving to another page
// takes the lock straight back instead of waiting for it to go stale.
function tabId() {
  try {
    let id = sessionStorage.getItem("analysisQueueTab");
    if (!id) {
      id = Math.random().toString(36).slice(2);
      sessionStorage.setItem("analysisQueueTab", id);
    }
    return id;
  } catch (_) {
    return Math.random().toString(36).slice(2);
  }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch (_) {
    return {};
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (_) {
    // Private mode etc.: the queue still runs for this page.
  }
}

// Takes the lock unless another tab refreshed it recently.
function takeLock() {
  try {
    const lock = JSON.parse(localStorage.getItem(LOCK));
    if (lock && lock.tab !== TAB && Date.now() - lock.at < STALE_MS) return false;
    localStorage.setItem(LOCK, JSON.stringify({ tab: TAB, at: Date.now() }));
    return true;
  } catch (_) {
    return true;
  }
}

function releaseLock() {
  clearInterval(heartbeat);
  try {
    const lock = JSON.parse(localStorage.getItem(LOCK));
    if (lock && lock.tab === TAB) localStorage.removeItem(LOCK);
  } catch (_) {
    // ignore
  }
}

function show(text, { state = "is-running", href = "/games" } = {}) {
  status.hidden = false;
  status.textContent = text;
  status.href = href;
  status.className = `queue-status mono ${state}`;
}

function markButtons() {
  document.querySelectorAll("[data-start-analysis]").forEach((btn) => {
    btn.disabled = true;
    btn.textContent = "Analyzing…";
  });
}

function start() {
  const state = load();
  if (!state.active) save({ active: true, done: 0, drills: 0, failed: [] });
  markButtons();
  run();
}

async function run() {
  const state = load();
  if (!state.active || running) return;
  state.failed = state.failed || [];
  markButtons();
  if (PAUSED_HERE) return show("Analysis paused while you play", { state: "" });
  if (!takeLock()) {
    show("Analyzing in another tab", { state: "" });
    setTimeout(run, STALE_MS);
    return;
  }
  running = true;
  heartbeat = setInterval(takeLock, HEARTBEAT_MS);

  try {
    for (;;) {
      const queue = (await (await fetch("/train/queue")).json()).filter(
        (g) => !state.failed.includes(g.id),
      );
      if (queue.length === 0) break;
      const game = queue[0];
      const position = `${state.done + 1} / ${state.done + queue.length}`;
      show(`Analyzing ${position}`);

      let result = null;
      try {
        const payload = await analyzeGame(historyFromPgn(game.pgn), (done, total) =>
          show(`Analyzing ${position} · ${Math.round((100 * done) / total)}%`),
        );
        result = await saveAnalysis(game.id, payload);
      } catch (err) {
        console.warn("Could not analyze game", game.id, err);
      }
      if (result) {
        state.done++;
        state.drills += result.drills;
      } else {
        state.failed.push(game.id);
      }
      save(state);
    }
    save({ active: false, finished: true, done: state.done, drills: state.drills });
    finished();
    if (RELOAD_WHEN_DONE) location.reload();
  } finally {
    running = false;
    releaseLock();
  }
}

// "3 new drills → Train" until you open the Train page or click it.
function finished() {
  const state = load();
  if (!state.finished) return;
  if (state.drills > 0) {
    show(`${state.drills} new drill${state.drills === 1 ? "" : "s"} → Train`, { state: "is-done", href: "/train" });
  } else {
    show("Analysis done", { state: "is-done", href: "/games" });
  }
  status.addEventListener("click", () => save({}), { once: true });
}

if (status && userId) {
  window.analysisQueue = { start };
  window.addEventListener("pagehide", () => running && releaseLock());
  document.querySelectorAll("[data-start-analysis]").forEach((btn) =>
    btn.addEventListener("click", start),
  );
  // Right after an import, start on the new games.
  if (Number(new URLSearchParams(location.search).get("imported")) > 0) start();
  else if (load().active) run();
  else if (location.pathname.startsWith("/train")) save({});
  else finished();
}
