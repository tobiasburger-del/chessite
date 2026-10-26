# Chess Companion — clearer flow, board UX and move labels

Date: 2026-10-26 · Status: draft for approval

## Why
The training loop (import → analyze → drill → play bots → insights) works, but
the site doesn't lead you through it. Usernames live in Settings, import on
Import, analysis on Train, and nothing tells you what to do next. The boards
also lack basics players expect from Lichess / Chess.com: legal-move hints,
click-to-move, a promotion choice, and labels on every move, not just the bad
ones. The owner uses this to train on their own mistakes; anything that slows
that loop down is the problem to fix.

## Goals
1. One obvious path from "new account" to "playing a bot on my weak spot".
2. Lichess / Chess.com connection is the flagship way to get games in.
3. Boards you move on feel like a real chess site.
4. Every analyzed move carries a clear label, and the review tells you what
   went wrong and what to do about it.

## Non-goals
- A visual redesign. The paper-and-ink look (Fraunces / Newsreader / IBM Plex
  Mono, paper/ink/oxblood tokens) stays; we refine it.
- "Brilliant" / "great" / book-move detection, sounds, board themes,
  server-side analysis, exploring side variations on the review board.
- Monetization features.

## Anti-goals
- More pages or settings to learn. Every change should remove a step or a
  decision, not add one.
- PGN paste being as prominent as account import.

## Constraints
- Existing stack: Express 5, EJS, Postgres, chess.js v1, cm-chessboard v8,
  Stockfish WASM in the browser. No new dependencies needed: cm-chessboard
  ships Markers and PromotionDialog extensions.
- MVC rules from CLAUDE.md (no SQL in controllers, client JS in `public/js/`).
- Ships in four phases, each its own commit, each usable on its own.

## Phase 1 — Board interaction (Train and Play boards)
- **Legal-move hints:** when you pick up or click one of your pieces, every
  legal target shows a grey dot; capture targets show a ring; the selected
  square is highlighted. Hints clear on move or deselect.
- **Click-to-move:** click piece, click target. Drag still works. Clicking
  another own piece switches selection; clicking elsewhere deselects.
- **Last move** from/to squares stay highlighted; **king in check** gets a
  red glow.
- **Promotion:** a piece picker (cm-chessboard PromotionDialog) instead of
  always queening. The bot's promotions come from the engine as before.
- **Shared code:** one `public/js/boardUi.js` used by `train.js` and
  `play.js`, so both boards behave the same.
- The game-review board stays view-only (navigate moves), but gets the
  last-move highlight, check glow and the label badge (Phase 2).

## Phase 2 — Move labels and game review
- **Labels on every analyzed move:** ★ best, ✓ good, ?! inaccuracy,
  ? mistake, ?? blunder. One colour per label used everywhere (board badge,
  move table, eval graph, drills, games list): best = moss, good = muted
  ink, inaccuracy = ochre, mistake = rust, blunder = oxblood (existing
  tokens).
- **Board badge:** a small round badge with the label symbol on the
  destination square of the current move.
- **Move table:** two columns (No. | White | Black) replacing the single list;
  keyboard and click navigation as today.
- **Accuracy % per side** in the review summary, computed from win-% drops
  (Lichess-style accuracy formula) in a pure, tested helper.
- **Eval graph:** an SVG line of White's win chance across the game, your
  inaccuracies/mistakes/blunders as coloured dots, current ply marked;
  clicking jumps to that ply.
- **Move explanation** for your errors: "You played Nf3?? — best was Qxd5.
  You dropped 34% winning chances." with a "Show best move" arrow toggle and,
  if a drill exists for that move, "Train this position" linking to it.
- **"Next error ▶"** button jumps to your next inaccuracy-or-worse.

## Phase 3 — One clear path
- **Today page** (`/` when logged in; logged-out visitors keep the landing
  page). Two states:
  - *Setup* (any step not done): a checklist that ticks itself from data —
    1 Connect an account (a username saved), 2 Import games (≥1 game),
    3 Analyze (≥1 analyzed game), 4 First drill (≥1 drill attempt),
    5 First bot game (≥1 saved bot game). Each step has one button to do it.
  - *Daily* (all done): "N drills due → Start", "Weak spot of the day →
    Play it" (top spot from Insights), "N games not analyzed → Analyze",
    and the last few games with their error counts.
- **Connect & Import page** (`/import`): two big cards, Lichess and
  Chess.com. Not connected: username field + "Connect & import" (saves the
  username and imports the latest 50 in one submit). Connected: username,
  number of games imported from it, "Import latest games", "Change". At the
  bottom, one small link "Have a PGN? Paste it here" that expands the paste
  box. Nowhere else links to PGN paste. Settings keeps the username fields.
- **Auto-analyze after import:** after an import lands on the Games page,
  the browser starts analyzing new unanalyzed games right away (same queue
  as Train's "Analyze all") with a progress bar; when done: "N drills ready
  → Start training".
- **Next step at every end-state:**
  - Game review: "Drill the N mistakes from this game" (Train filtered to
    that game).
  - Drill session finished / nothing due: "Play a bot game around this weak
    spot".
  - Bot game finished: its review, then "Drill these".
- **Navigation:** Today · Games · Train · Play · Insights. Import becomes a
  button on Games (and the Today checklist). Settings and Log out move into
  an account menu at the right.
- **Games list:** each game shows analysis status — error counts
  (?? 1 · ? 2 · ?! 3) when analyzed, an "Analyze" button when not.

## Phase 4 — Visual polish
- The three board pages share one layout: board left, panel right with the
  same order (status → main action → details). On mobile the board is full
  width and the panel follows.
- One page-header pattern and one empty-state pattern used everywhere.
- Label colours and symbols checked for contrast; symbols always shown so
  colour is never the only signal.

## Decisions made while writing (author's calls, check these)
- **Auto-analyze survives leaving the page.** The queue lives in one shared
  script loaded on every logged-in page; a small progress indicator sits in
  the navbar and the queue resumes on each page load (the game in progress
  restarts). When the queue empties, the indicator becomes "N drills ready →
  Train".
- **Games with unknown side** get a side picker right on their games-list
  row ("You were: ○ White / ● Black") and are not analyzed until picked,
  since labels, drills and errors are all about your moves. With an account
  connected this should be rare (mostly pasted PGNs).
- **Import fetches everything new.** First connect imports your latest 50
  games. "Import latest games" afterwards fetches games newer than the
  newest one already in your library from that account, capped at 100 per
  click. The 10/25/50 picker goes away.
- **Error counts are your moves only, everywhere.** Games list and Today
  show your ?? · ? · ?! counts. "Drill the N mistakes from this game" counts
  that game's drills (mistakes + blunders). "Next mistake ▶" visits your
  inaccuracies too, and is labelled "Next error" to avoid the mismatch.
  Replayed moves before `start_ply` in bot games show their labels greyed
  out and are never counted.

## Left to the builder
- Exact markup/CSS, badge sizing, graph styling within the existing look.
- How the auto-analyze queue is shared between Games and Train.
- Query shapes for the Today counts and "games imported per account".
- Tests: pure helpers (accuracy, setup-checklist state) get Jest tests; UI is
  checked in the browser.
