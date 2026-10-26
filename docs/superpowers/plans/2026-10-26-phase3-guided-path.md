# Phase 3 — One Clear Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A logged-in user is led from connecting an account to playing a bot on their weak spot: Today page, Connect & Import, analysis that runs in the background across pages, a next step at every end state, simpler navigation, and a games list that shows analysis status.

**Architecture:** Pure helpers (`utils/today.js` setup steps, `utils/onlineGames.js` new-games cut-off, `utils/insights.js` game spot) carry the testable logic. New `controllers/todayController.js` renders `views/today.ejs`. One browser module `public/js/analysisQueue.js`, loaded from the navbar on every logged-in page, owns the analyze-all queue (state in `localStorage`, keyed by user id).

**Tech Stack:** Express 5, EJS, Postgres, Stockfish WASM in the browser, Jest.

**Spec:** `docs/superpowers/specs/2026-10-26-ux-structure-design.md` (Phase 3 + Decisions).

## Global Constraints
- First connect imports the latest **50** games. "Import latest games" fetches games newer than the newest one already imported from that account, **capped at 100**. The 10/25/50 picker goes away.
- PGN paste: one small link at the bottom of `/import` ("Have a PGN? Paste it here") that expands the box; nothing else links to it.
- Nav (logged in): Today · Games · Train · Play · Insights, plus an account menu (Settings, Log out). Import is a button on Games and a Today step.
- Error counts are your moves only, replayed bot-game moves excluded.
- Analysis queue survives page changes; the game being analyzed restarts after a page load. It does not run on `/play` (the bot needs the CPU) — the indicator says it's paused.
- No SQL in controllers; no logic in views.

## Review Focus
1. Wrong / unknown username on Connect → error shown, username **not** saved.
2. Re-import with nothing new → "No new games" summary, not an error.
3. Two tabs open → only one runs the queue (heartbeat lock).
4. Logging in as another user in the same browser → no queue state leaks (keyed by user id).
5. Games with unknown side → side picker on the row; not in the queue until picked.

---

### Task 1: Import — Connect & Import, everything new

**Files:** `utils/onlineGames.js`, `controllers/importController.js`, `models/game.js`, `models/user.js`, `views/import.ejs`, `public/css/style.css`; Test `tests/onlineGames.test.js`

**Produces:**
- `newestUnknown(pgns, isKnown) -> string[]` — newest-first PGNs up to (not including) the first whose source URL `isKnown`.
- Fetchers take `(username, { max, isKnown })`; Chess.com stops walking months at the first known game.
- `Game.sourceUrlsForUser(userId) -> Set<string>`, `Game.countBySourceForUser(userId) -> { lichess, chesscom }`, `User.setUsername(id, field, name)`.
- `POST /import/online` body `{ source, username? }`: with a username → validate (`/^[A-Za-z0-9_-]{2,30}$/`), fetch 50, then save username, recompute colours, sync drills, store; without → fetch new (cap 100).

- [ ] Tests for `newestUnknown` (stops at first known; all new; empty; PGN without URL counts as new); fail → implement → pass.
- [ ] Controller, models, view (two cards; connected state shows username + games count + "Import latest games" + "Change" → /settings; PGN `<details>` at bottom).
- [ ] curl: bad username → 400 and not saved; commit.

### Task 2: Navigation, games list, Today

**Files:** `views/partials/navbar.ejs`, `routes/pageRoutes.js`, Create `controllers/todayController.js`, `views/today.ejs`, `utils/today.js`, `tests/today.test.js`; Modify `models/game.js`, `models/drill.js`, `controllers/gameController.js`, `views/games.ejs`, `public/css/style.css`

**Produces:**
- `setupSteps({ connected, games, analyzed, attempts, botGames }) -> { steps: [{ key, title, text, done, href, cta }], done: boolean }` — steps in order connect, import, analyze, drill, play; only the first not-done step is "current".
- `Game.progressForUser(userId) -> { games, analyzed, unanalyzed, botGames }` (bot games = `site = 'Chess Companion'`; unanalyzed = side known).
- `Game.listForUser` adds your `blunders`, `mistakes`, `inaccuracies` (your colour, ply > start_ply).
- `Drill.statsForUser` adds `attempts` (sum).
- `/` logged in → Today: setup checklist while any step is open, else daily cards: drills due → Train; weak spot of the day (top Insights spot) → Play; unanalyzed games → Analyze (starts queue); last 5 games with error counts.
- Games list: error counts or "Analyze" button; unknown side → inline "You were ○ White / ● Black" (posts `/games/:id/side` with `back=list`).

- [ ] `setupSteps` tests → implement → pass. Then UI; browser check; commit.

### Task 3: Background analysis queue

**Files:** Create `public/js/analysisQueue.js`; Modify `views/partials/navbar.ejs`, `public/js/train.js`, `views/train.ejs`, `public/css/style.css`

**Produces:** module exposes `window.analysisQueue = { start() }`; any `[data-start-analysis]` button calls it. Navbar indicator states: running "Analyzing 2 / 7", paused on /play, done "N new drills → Train". Auto-starts when the URL has `imported` > 0. Lock: `localStorage` heartbeat every 3 s, stale after 10 s.

- [ ] Implement; Train page "Analyze all" uses it (remove its own loop); browser: start on Games, navigate to Train mid-run, it resumes; finish shows drills link; commit.

### Task 4: Next step at every end state

**Files:** `utils/insights.js` (+ test), `models/drill.js`, `views/game-detail.ejs`, `views/train.ejs`, `views/play.ejs`, `public/js/play.js`

- `parseSpot("game:12")` → `{ kind: "game", value: 12 }`; `spotLabel` → "Mistakes from this game"; `spotCondition` → `d.game_id = $n`.
- Game review: "Drill the N mistakes from this game →" (`/train?spot=game:ID`) when N > 0.
- Train caught up / focus empty: primary "Play your weak spot vs a bot" (`/play` or `/play?spot=…`).
- Bot game summary: "Drill these →" (`/train?spot=game:<saved id>`) when the analysis added drills.

- [ ] Tests for game spot; implement; browser; `npm test`; commit.
