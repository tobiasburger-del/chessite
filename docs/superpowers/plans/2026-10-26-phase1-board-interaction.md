# Phase 1 — Board Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Train and Play boards show legal-move hints, support click-to-move, highlight the last move and a checked king, and let you choose the promotion piece; the review board gets last-move and check highlights.

**Architecture:** Pure chess rules for the UI (targets, promotion, check square) go in a UMD helper `public/js/boardRules.js` (browser global + Jest, like `moveClassifier.js`), taking a chess.js instance. A browser ES module `public/js/boardUi.js` builds the shared cm-chessboard (Markers, Arrows, PromotionDialog) and wires player input; `train.js`, `play.js` and `board.js` use it instead of their own Chessboard setup.

**Tech Stack:** cm-chessboard 8 (Markers, Arrows, PromotionDialog extensions, already vendored), chess.js 1, Jest.

**Spec:** `docs/superpowers/specs/2026-10-26-ux-structure-design.md` (Phase 1). Phases 2–4 get their own plans when we reach them.

## Global Constraints
- No new dependencies. Look stays paper-and-ink: use existing tokens (`--ink`, `--oxblood`, `--board-*`).
- Client JS in `public/js/`, camelCase file names.
- Click-to-move is built into cm-chessboard's move input; don't reimplement it.
- Review board stays view-only.

## Review Focus
1. Promotion dialog cancelled (click outside / Esc) → pawn goes back, it's still your move.
2. Under-promotion (knight) in a drill → the move checked is `e7e8n`, not a queen.
3. Clicking an opponent's piece or an empty square → no hints, nothing selected.
4. Weak-spot replay in Play: hints only for your colour, and old-game-following still detects a deviation when you promote.
5. Check glow clears after the check is resolved (next move, Retry in Train, nav in review).

---

### Task 1: `boardRules.js` — pure helpers

**Files:** Create `public/js/boardRules.js`; Test `tests/boardRules.test.js`

**Interfaces — Produces** (global `BoardRules` / CommonJS):
- `legalTargets(chess, square) -> Array<{ to: string, capture: boolean }>` — one entry per target square (promotions collapse to one).
- `isPromotion(chess, from, to) -> boolean`
- `checkedKingSquare(chess) -> string | null` — square of the side-to-move's king when in check.

- [ ] **Step 1: failing tests** (`const { Chess } = require("chess.js")`):
  - `legalTargets(new Chess(), "e2")` → targets `["e3","e4"]`, both `capture:false`.
  - From FEN `rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2`, `e4` targets include `{to:"d5",capture:true}`.
  - En passant: FEN `4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1`, `e5` targets include `{to:"d6",capture:true}`.
  - Promotion collapses: FEN `4k3/P7/8/8/8/8/8/4K3 w - - 0 1`, `legalTargets(.., "a7")` has length 1; `isPromotion(.., "a7","a8")` true; `isPromotion(new Chess(),"e2","e4")` false.
  - Opponent piece / empty square → `[]`.
  - `checkedKingSquare` → `"e1"` for FEN `4k3/8/8/8/8/8/4q3/4K3 w - - 0 1`; `null` for start position.
- [ ] **Step 2:** `npx jest tests/boardRules.test.js` → FAIL (module not found).
- [ ] **Step 3:** implement with `chess.moves({ square, verbose: true })` (capture = `move.captured` present) and `chess.inCheck()` + `chess.board()` scan. UMD wrapper exactly like `moveClassifier.js`.
- [ ] **Step 4:** `npm test` → all pass.
- [ ] **Step 5:** commit.

### Task 2: `boardUi.js` + Train board

**Files:** Create `public/js/boardUi.js`; Modify `public/js/train.js`, `views/train.ejs`, `public/css/style.css`

**Interfaces — Produces** (ES module):
- `createBoard(el, { position, orientation }) -> Chessboard` — current shared style (`bulletin`, coordinates, thin border, standard pieces, 220 ms), extensions Markers (autoMarkers = selected-square type), Arrows (`headSize 8, offsetTo 0.25`), PromotionDialog.
- `enablePlayerInput(board, { fen: () => string, color: "w"|"b", onMove: (move) => void })` — own pieces only; on pick-up shows legal dots / capture rings from `legalTargets`; validates legality; promotion opens the dialog and calls `onMove` with the chosen piece, cancel restores the position and keeps input on; `move` is a chess.js verbose move from `new Chess(fen())`. Hints cleared on finish/cancel.
- `showLastMove(board, from, to)`, `showCheck(board, fen)`, `clearHighlights(board)`.
- **Consumes:** `globalThis.BoardRules` (Task 1, loaded as classic script before modules).

- [ ] **Step 1:** implement `boardUi.js`. Custom marker types: `{class:"marker-selected", slice:"markerSquare"}`, `{class:"marker-last-move", slice:"markerSquare"}`, `{class:"marker-check", slice:"markerCircleFilled"}`; hints use the library's `MARKER_TYPE.dot` / `MARKER_TYPE.bevel`.
- [ ] **Step 2:** CSS in `style.css` under `.cm-chessboard.bulletin`: dot = ink at ~0.25 opacity; bevel ring = ink ~0.3; selected & last-move = translucent ochre fill; check = oxblood radial fill ~0.55. Link `markers.css` and `promotion-dialog.css` in `train.ejs`; load `boardRules.js` before `train.js`.
- [ ] **Step 3:** `train.js` uses `createBoard` + `enablePlayerInput`; `onMove` gets the real promotion so the UCI includes it; after the move `showLastMove`; Retry calls `clearHighlights`.
- [ ] **Step 4 (browser):** on a drill: picking a piece shows dots/rings; click-click and drag both work; opponent piece shows nothing; correct-answer flow unchanged. Check console is clean.
- [ ] **Step 5:** commit.

### Task 3: Play board

**Files:** Modify `public/js/play.js`, `views/play.ejs`

- [ ] **Step 1:** replace Chessboard setup with `createBoard`; replace `onInput`/`tryMove` with `enablePlayerInput({ fen: () => game.fen(), color: userColor, onMove })`; `onMove` plays `{from,to,promotion}` on `game` (deviation check unchanged); `afterMove` uses `showLastMove` + `showCheck(board, game.fen())` instead of `MARKER_TYPE.square`. Link `promotion-dialog.css`, load `boardRules.js`.
- [ ] **Step 2 (browser):** free game vs level 1: hints, last move highlighted for both sides, check glow appears and clears, game saves. Promotion: verify via console position `game.load(...)`-free path by playing a short position? Use a weak-spot game is not needed — check the dialog with Train if no drill promotes (Review Focus 1, 2).
- [ ] **Step 3:** commit.

### Task 4: Review board highlights

**Files:** Modify `public/js/board.js`, `views/game-detail.ejs`

- [ ] **Step 1:** `board.js` uses `createBoard` (no input); on every ply change `clearHighlights`, then `showLastMove(history[ply-1].from, .to)` and `showCheck(board, fen)`; at ply 0 nothing. Link `markers.css`, load `boardRules.js`.
- [ ] **Step 2 (browser):** step through a game: last move highlighted, check glow on checking moves, best-move arrow still works.
- [ ] **Step 3:** `npm test`, commit.
