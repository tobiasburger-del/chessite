# Phase 2 — Move Labels and Game Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The game review labels every analyzed move, shows accuracy per side, an eval graph, a plain-language explanation of your errors with a best-move arrow and a link to the drill, and a "Next error" jump.

**Architecture:** Server: pure helpers in `utils/analysis.js` (accuracy, counts that skip replayed moves), a drill-per-move lookup in `models/drill.js`, the controller hands both to the view. Client: `board.js` drives a two-column move table; a new `public/js/evalGraph.js` draws the graph; the label badge on the board lives in `boardUi.js`.

**Tech Stack:** Express/EJS, chess.js, cm-chessboard, Jest.

**Spec:** `docs/superpowers/specs/2026-10-26-ux-structure-design.md` (Phase 2 + Decisions).

## Global Constraints
- Labels and symbols: best `★`, good `✓`, inaccuracy `?!`, mistake `?`, blunder `??`. Colours: best = `--moss`, good = `--ink-muted`, inaccuracy = `--ochre`, mistake = `--rust`, blunder = `--oxblood`. Symbol always shown with colour.
- "Errors" = your moves only. "Next error ▶" visits your inaccuracies, mistakes and blunders.
- Moves before `game.start_ply` (bot-game replay) show labels greyed out and are never counted (summary, accuracy, graph dots, Next error).
- Accuracy per move (Lichess): `103.1668 * exp(-0.04354 * drop) - 3.1669`, clamped 0–100, `drop` = mover's win-% loss (≥ 0); game accuracy = mean over that side's counted moves, rounded to an integer. My call: plain mean, not Lichess's volatility weighting.
- No business logic in views.

## Review Focus
1. Unanalyzed game → no labels, no graph, no Next error; table and navigation still work.
2. Game with unknown side → labels and graph for both, but no "You" explanation, no Next error.
3. Mate scores (`eval_mate`) in accuracy and graph → treated as 100/0 win %, no NaN.
4. Bot game with `start_ply` > 0 → replayed moves greyed and excluded from counts.
5. Error move with no drill (opponent's, or inaccuracy) → explanation without "Train this position".

---

### Task 1: Accuracy and counts helpers

**Files:** Modify `utils/analysis.js`; Test `tests/analysisPayload.test.js` (or new `tests/reviewStats.test.js`)

**Produces:**
- `moveScore(row) -> {cp}|{mate}|null` from a `move` row.
- `summarize(moves, startPly = 0)` — as today, skipping index < startPly.
- `accuracy(moves, startScore, startPly = 0) -> { w: number|null, b: number|null }`.

- [ ] Tests: perfect play (evals unchanged) → 100 both; a −300cp → 0 swing for White gives White < 100 and Black 100; replayed moves excluded from summarize & accuracy; missing evals → side `null`; mate scores give finite numbers.
- [ ] Run → fail; implement (uses `winChance` from `public/js/moveClassifier.js`); run → pass; commit.

### Task 2: Data for the review page + drill deep link

**Files:** Modify `models/drill.js`, `controllers/gameController.js`, `controllers/trainController.js`

**Produces:**
- `Drill.idsByMoveForGame(gameId, userId) -> Map<moveId, drillId>`.
- `show` passes `moves[i].drillId`, `startPly`, and summary rows with `accuracy`.
- `findWithGameForUser` also selects `g.opening`; `/train?drill=ID` shows that drill (404-safe: unknown id → normal next-due drill).

- [ ] Implement; `npm test`; curl `/train?drill=<id>` as test user → 200 with that drill's FEN; commit.

### Task 3: Move table, labels, board badge

**Files:** Modify `views/game-detail.ejs`, `public/js/board.js`, `public/js/boardUi.js`, `public/css/style.css`

- Move table: rows `No. | White | Black`; each ply is a `<button class="move-cell" data-ply …>` carrying today's data attributes plus `data-best-move`, `data-drill-id`, `data-mine` (move is yours), `data-replayed`. `board.js` navigates over `.move-cell` (click, Enter, arrow keys ←/→ on the page).
- Mark after SAN: symbol per label, coloured; replayed cells greyed.
- `boardUi.showMoveBadge(board, square, classification)` / `clearMoveBadge(board)`: a round badge (symbol, label colour) at the top-right corner of the destination square, positioned from `rect[data-square]`, recomputed on resize.
- Summary table gains an "Accuracy" column.

- [ ] Implement; browser: labels on every cell, badge follows navigation, flips with orientation; commit.

### Task 4: Eval graph, explanation, Next error

**Files:** Create `public/js/evalGraph.js`; Modify `public/js/board.js`, `views/game-detail.ejs`, `public/css/style.css`

**Produces:** `renderEvalGraph(svg, { scores, labels, mine, onSelect }) -> { setCurrent(ply) }` — scores per ply (index 0 = start), White win % as filled area (light = White), midline, coloured dots on your counted errors, current-ply line, click/tap selects nearest ply.

- Explanation (replaces `#move-note`) for your errors: "You played Nf3?? — best was Qxd5. You dropped 34% winning chances." + "Show best move" (toggles a success arrow for `data-best-move`) + "Train this position" (`/train?drill=ID`) when a drill exists. Other labelled moves: "12. Nf3 ★ Best move" style one-liner.
- "Next error ▶" next to the transport; jumps to your next counted error after the current ply, disabled when none; hidden when unanalyzed or side unknown.

- [ ] Implement; browser checks for Review Focus 1–5; `npm test`; commit.
