# Phase 4 — Walnut Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tiring "tournament bulletin" look with a calm, minimal one (option C · Walnut): one sans-serif family, neutral surfaces, one teal accent, distinct move-label colours, a bigger brown board, and a dark mode that follows the system (with a manual override).

**Architecture:** CSS-only redesign driven by semantic tokens on `:root`, redefined for dark mode. Old palette variable names are renamed to semantic ones in one mechanical pass, then each section is cleaned up. Views lose purely decorative markup (eyebrows, glyph dividers, load animations). A tiny inline script in `partials/head.ejs` applies a saved theme before paint; a button in the account menu cycles System / Light / Dark.

**Tech Stack:** CSS custom properties, EJS, IBM Plex Sans + IBM Plex Mono (Google Fonts), cm-chessboard.

**Background:** research and mockups in this session (fonts, contrast, all-caps, line length, familiarity). Supersedes the old "Phase 4 — visual polish" in `docs/superpowers/specs/2026-10-26-ux-structure-design.md`.

## Global Constraints
- Fonts: `IBM Plex Sans` for all text; `IBM Plex Mono` only for moves, evals, counts. Two weights: 400, 500.
- Sentence case everywhere; no `text-transform: uppercase`, no positive letter-spacing.
- Body 16px, line-height 1.5; nothing below 13px (0.8125rem).
- Light tokens: bg `#f7f6f3`, surface `#ffffff`, surface-2 `#efece6`, line `#e6e2da`, text `#22201c`, text-muted `#615b52`, accent `#1f6f78`.
- Dark tokens: bg `#1c1b19`, surface `#252421`, surface-2 `#2e2c28`, line `#3a3732`, text `#e9e6e0`, text-muted `#a8a196`, accent `#5fb3bb`.
- Labels (light / dark): best `#2e8b57`/`#5cc48a`, good `#8a8f98`/`#9aa0a8`, inaccuracy `#9a7400`/`#e0b43c`, mistake `#d4691a`/`#f08a3e`, blunder `#cf3a3a`/`#f06464`.
- Board: light `#f0d9b5`, dark `#b58863`; last move `#cdd26a`/`#aaa23a` (light/dark squares), both themes.
- Board column up to 600px on review, Train and Play (was 460px).
- Pieces stay cm-chessboard "standard" (Cburnett, CC BY-SA 3.0); add the attribution credit.
- Dark mode: `@media (prefers-color-scheme: dark)` on `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]`; choice stored in `localStorage` (`theme`), read in a try/catch.

## Review Focus
1. Every move-label colour and muted text keeps ≥ 4.5:1 contrast on its surface in both themes.
2. Board highlights, check glow, dots and the label badge stay visible on the brown board.
3. No horizontal scroll at 375px on any page.
4. Theme choice survives reloads and doesn't flash the wrong theme.
5. Eval bar and eval graph stay readable in dark mode.

---

### Task 1: Tokens, fonts, dark mode switch
**Files:** `public/css/style.css`, `views/partials/head.ejs`, `views/partials/navbar.ejs`, Create `public/js/theme.js`
- [ ] Rename palette variables to semantic names across CSS (`--paper`→`--bg`, `--paper-edge`→`--surface-2`, `--ink`→`--text`, `--ink-muted`→`--text-muted`, `--rule`→`--line`, `--oxblood`→`--accent`, `--oxblood-deep`→`--accent-strong`, `--moss`/`--ochre`/`--rust` → label tokens); replace hard-coded oxblood/ink rgba values with `color-mix` on tokens.
- [ ] New `:root` values + both dark blocks; fonts swapped; Fraunces/Newsreader removed from the font link.
- [ ] `theme.js`: `cycleTheme()` System → Light → Dark, button label shows the current choice.
- [ ] Contrast check script over the token pairs (Review Focus 1); commit.

### Task 2: Strip decoration, type scale
**Files:** `public/css/style.css`, all `views/*.ejs`
- [ ] Remove eyebrows, glyph dividers, corner-board art, `rise` classes and their keyframes; drop uppercase/letter-spacing/font-variation rules; minimum 13px; plain bordered inputs; flat cards (no shadows except the label badge and popovers).
- [ ] Browser pass over every page; commit.

### Task 3: Board
**Files:** `public/css/style.css`, `public/js/boardUi.js`, `views/settings.ejs`, `views/index.ejs`
- [ ] Walnut squares and highlights, bigger board column, frame simplified to a thin line, coordinates legible; credit line for the pieces.
- [ ] Browser: review, Train, Play in light, dark and at 375px; commit.
