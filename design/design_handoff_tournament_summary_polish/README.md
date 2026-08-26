# Handoff: Tournament (Stroke Play) — scorecard, leaderboard & summary polish

## Overview
This handoff covers a focused round of refinements to the **single-round Individual
Stroke Play (medal) tournament flow** in Golf Kaki. The work made three in-game/finish
screens (S7 Live scoring, S8 Scorecard grid, S9 Leaderboard, S10 Finish/Round summary)
visually and structurally consistent with one another. No new screens were added — every
change is an edit to an existing screen in `Golf Kaki Create Tournament - Stroke Play.dc.html`.

## About the Design Files
The file in this bundle is a **design reference created in HTML** — a prototype showing
the intended look and behavior, not production code to copy directly. The task is to
**recreate these changes in the target codebase's existing environment** (React, Vue,
SwiftUI, native, etc.) using its established components, tokens, and patterns. If no
environment exists yet, choose the most appropriate framework and implement there. The
inline styles in the HTML map to the Golf Kaki design tokens (see Design Tokens) — use the
codebase's token equivalents rather than hard-coding hex where tokens exist.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and layout. Recreate
pixel-accurately using the codebase's existing libraries. Exact values are given below.

---

## Changes this session (by screen)

### S7 · Live scoring — hole navigator restructured
The single centered "Hole 7 / Par 4 · SI 5 · 388m · you get 1 stroke" block was split into
a **two-block, left/right arrangement** to give more emphasis to the hole spec, flanked by
the existing prev/next chevrons.

- Row container: `display:flex; align-items:center; justify-content:space-between; margin-top:14px`.
- **Left chevron:** Lucide `chevron-left`, 22×22, color `rgba(255,255,255,.55)`.
- **Center group:** `flex:1; display:flex; align-items:center; justify-content:center; gap:14px; padding:0 8px`.
  - **Left block — hole number:** "Hole 7" — `--font-display`, weight 700, **font-size 28px**,
    `line-height:1`, `white-space:nowrap`.
  - **Divider:** 1px × 34px, `background:rgba(255,255,255,.2)`.
  - **Right block — hole spec (emphasized):**
    - Line 1: "Par 4" + "SI 5" in a baseline flex row, `gap:9px`, `--font-display`, weight 700,
      **font-size 18px**, `line-height:1`. "SI 5" is dimmed to `rgba(255,255,255,.82)`.
    - Line 2 (sub): "388m · you get 1 stroke" — `--font-body`, 11px, `rgba(255,255,255,.62)`,
      `margin-top:5px`, `white-space:nowrap`.
- **Right chevron:** Lucide `chevron-right`, 22×22, color `#fff`.

Also on S7's scorecard entry card, the player line reads **"Marcus · Playing HCP 13"**
(previously "Marcus · HCP 12.4") — see the shared change below.

### S8 · Scorecard grid — header brought in line with S7
The S8 green header previously had a plain back chevron and a shorter body. It now mirrors
S7's header treatment:

1. **Back chevron removed.** Rationale: the back arrow was inconsistent — most screens' back
   button returns to the landing page, but this one returned to the scorecard. Removed to
   avoid the inconsistent behavior.
2. **Replaced with a white "Score" pill** in the top-right group (beside the THRU pill),
   styled **identically to S7's "Card" pill**: `display:inline-flex; align-items:center;
   gap:5px; height:32px; padding:0 12px; border-radius:999px; background:#fff;
   --font-body; font-weight:700; font-size:12px; line-height:1; white-space:nowrap;
   color:#134914; box-shadow:0 2px 8px rgba(14,58,40,.22); cursor:pointer`. Leading Lucide
   icon `table-2`, 15×15, color `#134914`. Label text: "Score". Action: navigate to the
   scorecard (same destination the user landed here from).
3. **Title alignment kept consistent** — the "Scorecard" title stays at the same indent as
   the other screens (title left offset `left:10px` via `position:relative`).
4. **Subtitle changed** to **"Stroke play · Nett 95%"** (previously "Orchid CC · Aquatica +
   Dendro · nett") to match S7's subtitle.
5. **Emblem motif watermark added** to the header background: `assets/golf-kaki-mark.svg`,
   `position:absolute; right:-30px; top:-24px; width:120px; opacity:.09;
   filter:brightness(0) invert(1); pointer-events:none`. Header set to
   `position:relative; overflow:hidden`; the title row set to `position:relative`.
6. **Separator line added** under the title row: 1px, `background:rgba(255,255,255,.14)`,
   `margin-top:14px` (identical to S7's separator).
7. **Header length matched to S7 (≈136px tall).** Achieved via the Front 9 / Back 9 segmented
   toggle: tab vertical padding `8px 0`, toggle row `margin-top:14px; margin-bottom:5px`,
   header bottom padding `24px` (header padding `4px 18px 24px`).

### S9 · Leaderboard — table header turned green
The leaderboard table's header row changed from the sand fill (`#FBF8F0`, grey `#8A958C`
labels) to a **prominent green header**:
- Header row + its sticky left cell: `background:#134914`.
- Column labels (Pos/Player, Hole, Gross, Nett): `color:rgba(255,255,255,.72)`, uppercase,
  weight 700, 9px, letter-spacing `.05–.09em`.
- **"Total"** label emphasized in flag-orange `#FFC79E` (was green `#134914`).
- Everything else about the table (sticky player column, row highlight colors, score colors)
  is unchanged.

### S10 · Finish · round summary — standings converted to an S9-style table
Two changes here:

1. **"Final standings · nett" rebuilt as a single bordered table** (previously four separate
   rounded row cards). It now matches S9's table design:
   - Card wrapper: `background:#fff; border:1.5px solid #E3D9C0; border-radius:16px;
     box-shadow:0 4px 14px rgba(14,58,40,.06); overflow:hidden`.
   - **Green header row** (same treatment as S9): `background:#134914`, white `.72` labels,
     columns **Pos/Player · Gross · Nett · Total** — with the "Total" label in `#FFC79E`.
     (Note: the last column header was briefly labeled "To par" and is now "Total".)
   - Column widths: Player = `flex:1` (pos 30px + 30px avatar + name/HCP), Gross 44px,
     Nett 44px, Total 52px (`padding-right:10px`), all centered.
   - Rows: 1 Daniel Ong (winner — cream `#FBF6E9` fill, gold `#C8971C` rank + Lucide `crown`
     12px), 2 Marcus (you) (green tint `#F0F6EE`, green rank/name `#134914`), 3 Aisha Rahman,
     4 Jason Lim (white). Row separators `1px #EFE8D5`. Name line 13px/700, HCP sub 10px
     `#8A958C`. To-par values `--font-numeric` 15px/700, green `#1E8A4C` for under par,
     slate `#5E6B62` for level ("E").
2. **"Best gross" restyled as S9's green winner strip** (previously a white outlined cell).
   Now: `flex:none; background:#134914; border-radius:14px; padding:13px 15px; display:flex;
   align-items:center; gap:11px; position:relative; overflow:hidden`, with the emblem motif
   watermark (`right:-22px; top:-18px; width:92px; opacity:.10`), a 38×38 icon tile
   (`background:rgba(255,255,255,.12); border-radius:10px`) holding Lucide `award` 19px in
   flag-orange `#FF914D`, an overline "Best gross" (`rgba(255,255,255,.6)`, 10px, uppercase,
   `line-height:1.4`) and "Daniel Ong · 72 (E)" (`#fff`, 15px/700, `line-height:1.3`).
   `flex:none` is required so the strip keeps its natural height inside the flex-column body.

---

## Shared change
- **Handicap label wording:** on S7's scorecard entry card, the player's handicap is shown as
  **"Playing HCP 13"** (the playing handicap, a whole number) instead of the handicap index
  "HCP 12.4". Use the playing handicap (derived from index × slope/113 × allowance, rounded)
  wherever a per-round handicap is displayed in this flow, for consistency with S9/S10 where
  Marcus is HCP 13.

## Interactions & Behavior
- **S8 "Score" pill:** tap → navigate to the scorecard grid. This replaces the removed back
  chevron; it is an explicit, labeled destination rather than a generic back action.
- **S8 Front 9 / Back 9 toggle:** segmented control; active segment = white pill with green
  text, inactive = translucent white text.
- **S7 hole chevrons:** prev / next hole navigation (unchanged behavior).
- **S9 / S10 tables:** static display; standings/scores are derived from the round's per-hole
  scores (single source of truth). No new interaction added this session.
- Motion: design-system defaults — `--dur-base` 200ms, `--ease-out`; pills/buttons depress to
  `scale(.985)` on press.

## State Management
No new state introduced this session. All values shown (scores, to-par, handicaps, skins
settlement) are **derived from the round's per-hole score entries** — keep score entry as the
single source of truth and compute leaderboard/summary from it. The playing handicap is
derived from the handicap index + course/tee slope + format allowance.

## Design Tokens (values used this session)
Colors:
- Fairway green (primary / headers): `#134914`
- Flag orange (accent, "Total" label on green, award icon): `#FF914D`; soft variant `#FFC79E`
- Ink text: `#1C2B22`; muted `#8A958C`, `#5E6B62`
- Under-par / positive score: `#1E8A4C`; level ("E"): `#5E6B62`
- Gold (winner rank/crown): `#C8971C`
- Surfaces: white `#fff`, winner cream `#FBF6E9`, "you" green tint `#F0F6EE`
- Borders: `#E3D9C0` (default), `#EFE8D5` (row separators), `#CDE3C8` (green-tint border)
- On-green whites: label `rgba(255,255,255,.72)`, overline `rgba(255,255,255,.6)`,
  separator `rgba(255,255,255,.14)`, divider `rgba(255,255,255,.2)`

Typography:
- Display (`--font-display`, Quicksand): hole number 28px/700, hole spec 18px/700, section
  titles 16–17px/700
- Body (`--font-body`, Plus Jakarta Sans): labels 9–12px, subs 10–11px
- Numeric (`--font-numeric`, Space Grotesk, tabular): scores/to-par 12–15px

Radius: card `16px` (tables) / `14px` (strips) / `18px`, pill `999px`, icon tile `10px`.
Shadow: cards `0 4px 14px rgba(14,58,40,.06)`; pill `0 2px 8px rgba(14,58,40,.22)`;
warm green-tinted throughout (never neutral grey).

## Screenshots
Reference captures of the affected screens are in `screenshots/` (each 720×1520, 2×):
- `S7-live-scoring.png` — two-block hole navigator, "Playing HCP 13".
- `S8-scorecard-grid.png` — green header with motif, separator, "Score" pill, matched height.
- `S9-leaderboard.png` — green table header.
- `S10-round-summary.png` — S9-style standings table + green best-gross strip.

## Assets
- `assets/golf-kaki-mark.svg` — emblem mark, used as the low-opacity header/strip watermark
  (rendered white on green via `filter:brightness(0) invert(1)`).
- Icons: Lucide (2px stroke, `currentColor`): `table-2`, `award`, `crown`, `chevron-left`,
  `chevron-right`, plus the existing status-bar/tab-bar icons.

## Files
- `Golf Kaki Create Tournament - Stroke Play.dc.html` — the design reference (copied into this
  folder). Relevant sections are marked in source comments: `S7 · LIVE SCORING`,
  `S8 · SCORECARD GRID`, `S9 · LEADERBOARD`, `S10 · FINISH · ROUND SUMMARY`.
- Design system: bound Golf Kaki Design System (tokens + components). Use its `Button`,
  `Avatar`, `ScoreBadge`, `LeaderboardRow`, `Card` equivalents in the target codebase.
