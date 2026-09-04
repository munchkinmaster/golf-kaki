# Handoff: Create Tournament — Stableford flow

## Overview
This handoff covers the **individual Stableford (points) tournament flow** in Golf
Kaki: format selection, Stableford-specific rules configuration, the in-round
lobby, live points scoring, the points scorecard grid, the leaderboard, and the
finish/round-summary screen. It is a sibling flow to the Stroke Play (medal)
tournament flow in the same file — steps 2 (Course) and 4 (Players) of the
"Create a tournament" wizard are shared/generic across formats and are **not**
part of this handoff (see Screens table below for what's in vs. out of scope).

## About the Design Files
The bundled file is a **design reference created in HTML** — a prototype showing
intended look and behavior, not production code to copy directly. Recreate these
screens in the target codebase's existing environment (React, Vue, SwiftUI,
native, etc.) using its established components, tokens, and patterns; if no
environment exists yet, choose the most appropriate framework and implement
there. Inline styles map to Golf Kaki design tokens (see Design Tokens) — use
the codebase's token equivalents rather than hard-coding hex where tokens exist.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and layout. Recreate
pixel-accurately using the codebase's existing libraries. Exact values are given
below.

## Screens

All screens are mobile, 360×760 device frame, status bar + (where noted) green
header, scrollable body (`.gkscreen`), sticky bottom action and/or in-game tab
bar. Source markers in the HTML are HTML comments, e.g. `SB1 · FORMAT`.

| Screen | Source comment | Purpose |
|---|---|---|
| **SB1 · Format** | `SB1 · FORMAT (Stableford selected)` | Step 1 of 4. Name field, scoring-format picker (Stroke play vs. **Stableford**, Stableford selected), points-per-hole reference card, round-structure toggle. |
| **SB3 · Stableford rules** | `SB3 · STABLEFORD RULES` | Step 3 of 4 (step 2 "Course" is shared/generic, out of scope here). Points table, handicap-allowance slider, target-points callout, tie-break choice. |
| **SB6 · Lobby (in-round)** | `SB6 · LOBBY (Stableford)` | Pre/in-round lobby: field list with tee + playing-handicap editors, format & rules summary, in-game bottom tab bar (Lobby active, no Start button). |
| **SB7 · Live scoring** | `SB7 · LIVE SCORING (Stableford)` | Hole-by-hole entry: two-block hole navigator, big stroke stepper, derived-points readout, running totals (Points/Gross/Pace), this-hole field status. |
| **SB8 · Scorecard grid** | `SB8 · SCORECARD GRID (points)` | Full 9-hole grid with par/SI/player point columns, dot markers for handicap strokes, your-totals strip (Gross/Nett/Points), score-term legend. |
| **SB9 · Leaderboard** | `SB9 · LEADERBOARD (points)` | Sticky-column table: Pos/Player · Thru · Gross · Nett · Points, rank-delta chevrons, "plays to handicap" callout. |
| **SB10 · Finish · round summary** | `SB10 · FINISH · ROUND SUMMARY (points)` | Round-complete hero (Gross/Points/To HCP), "you finished" card, final-standings table (**Gross · Nett · Points** — added this session, see below), best-gross strip, Scorecard/Done actions. |

**Out of scope (shared across formats, not Stableford-specific):** wizard step 2
"Course & holes" (`04`/`04b`) and step 4 "Players/Entrants" (`12c`-style) — build
these once and reuse for every scoring format per `WIRE-UP.md`.

### Layout & components (apply to all screens above)
- Frame: `width:360px; height:760px; border-radius:36px`, card shadow
  `0 14px 44px rgba(14,58,40,.20)`.
- Status bar: 40px, transparent on light screens (SB1/SB3) or green `#134914`
  on in-round screens (SB6–SB10). Lucide `signal`/`wifi`/`battery-full`.
- Wizard header (SB1/SB3): back circle button, title, 4-segment progress bar
  (`height:5px; border-radius:999px`, filled segments `#134914`, unfilled
  `#E3D9C0`) with step labels below, active label `#134914`, done `#7C8A7E`,
  upcoming `#A89B7C`.
- In-round green header (SB6–SB10): `background:#134914`, emblem watermark
  `assets/golf-kaki-mark.svg` top-right at low opacity (`right:-30px;top:-24px;
  width:120px;opacity:.09;filter:brightness(0) invert(1)`), hairline separator
  `rgba(255,255,255,.14)` under the title row.
- In-round bottom tab bar (SB6–SB9): 4 tabs — Scorecard (`list`) / Leaderboard
  (`trophy`) / Lobby (`users`) / Finish (`circle-check-big`). Active tab green
  `#134914` + weight 600 label; inactive `#B4BCB5`. No Start accent (round is
  already live).
- Primary CTA pill: `height:54–56px; border-radius:999px; background:#FF914D;
  box-shadow:0 6px 18px rgba(255,145,77,.4)`, white text, weight 600, trailing
  Lucide `arrow-right`.

### SB1 · Format
- Name input: 50px, `border:1.5px solid #E3D9C0; border-radius:12px`.
- Format options list: unselected card `#fff` border `#E3D9C0`, icon tile
  `#F2EEE2` / grey icon, radio `circle`; selected (Stableford) card
  `background:#F0F6EE; border:1.5px solid #134914`, icon tile `#134914` with
  white icon, radio `check-circle-2` green.
- Points-per-hole reference card: 6-cell grid (Albatross 5 / Eagle 4 / Birdie 3
  / Par 2 / Bogey 1 / Double+ 0), each cell tinted to its score-color family
  (gold/orange/green/blue/red per design-system score colors), plus a
  `shield-check` footnote: "Strokes are applied first, then points scored
  against nett par. One blow-up hole never wrecks your card."
- Round structure: 2-up segmented buttons, Single round (selected, green fill)
  vs. Multi-round (outline).

### SB3 · Stableford rules
- Points table card: header row "Standard" + green "Selected" pill, then the
  same 6-value point scale in a single row (5/4/3/2/1/0), each numeral colored
  per its score-color family. Caption: "Points are worked out against your nett
  score on each hole."
- Handicap allowance: label + live value (`95%`), custom slider track
  (`height:8px`, filled `#134914` on `#E3D9C0`, thumb white 22px circle with
  green ring), end labels "Scratch (0%)" / "Full (100%)".
- Target callout: icon tile + "Playing to handicap = 36 pts" / "2 points a hole
  across 18 holes".
- Tie-break: 2 selectable rows, Countback (selected, green) vs. Shared place
  (outline), same visual pattern as the format picker on SB1.

### SB6 · Lobby (in-round)
- Header: tournament name, "Stableford · Nett 95%" subtitle, live `THRU 6` pill
  (orange dot + `#FFC79E` text on translucent white), invite code row with
  copy/share icon buttons.
- Field rows: avatar, name (+ "Host" pill for the organizer), handicap index,
  per-player Tee selector (colored dot + tee name + chevron) and Playing HCP
  editor (green pill with pencil icon), stacked with small uppercase labels
  underneath ("Tee" / "Play HC").
- Format & rules summary: 4-row key/value table (Format, Winner, Tie-break,
  Scoring) plus an info banner: "Handicaps and format lock once the round
  starts. Points are scored off each player's nett par."

### SB7 · Live scoring
- Hole navigator: chevron-left / **Hole 7** (28px display bold) / vertical
  divider / **Par 4 · SI 5** (18px display bold, SI dimmed) with sub-line
  "388m · you get 1 stroke" / chevron-right.
- Score entry card: player row (avatar, "Your score" / "Marcus · Playing HCP
  13") + green "Saved" pill; center stepper (− circle / big 64px stroke count
  / + orange circle); derived-points banner ("Nett par (1 stroke here) = **2
  pts**"); 4 quick-pick stroke chips each pre-labeled with its resulting points
  (e.g. "5 · 2pt"), colored by score term.
- Running totals strip: Points (green fill, white text) / Gross / Pace, 3-up.
- This-hole field list: each opponent row shows nett score-term + gross in the
  sub-line and a colored points chip on the right; unsubmitted players get a
  dashed border and an "Enter" action pill instead of a points chip.
- CTA: "Next hole" (advances the hole navigator).

### SB8 · Scorecard grid
- Header: title "Scorecard" / "Stableford · Nett 95%" subtitle, "Score" pill
  (same treatment as SB7's "Card" pill), `THRU 9` status pill, Front 9 / Back 9
  segmented toggle (active = white pill, green text).
- Grid: H / Par / SI columns + one column per player, header cells show avatar
  initial + short name; each score cell shows the gross number with small dot
  markers (top-right) — dot color/count encodes score-term (eagle+, birdie,
  par, bogey) and a separate small green dot marks a handicap stroke received.
  Footer summary row totals the columns.
- Your-totals strip: Gross / Nett / Points (Points cell green-filled to match
  its emphasis elsewhere).
- Legend: dot key for Eagle+/Birdie/Par/Bogey/Handicap stroke, muted grey text.

### SB9 · Leaderboard
- Header: "Leaderboard" title, "Sunday Stableford · Orchid CC" subtitle,
  `THRU 18` status pill.
- Status line under header: green `circle-dot` + "Final · 18 holes ·
  Stableford · nett 95%".
- Table (green header row, sticky Player column, same visual language as the
  Stroke Play leaderboard): **Pos/Player · Thru · Gross · Nett · Points**, with
  "Points" label in flag-orange `#FFC79E`. Winner row cream `#FBF6E9` + gold
  rank + `crown`; your row green-tinted `#F0F6EE`. Rank-delta indicator next to
  position (`chevron-up`/`chevron-down`/`minus`, green/red/grey).
- "36 pts plays to handicap" info card below the table (icon tile + copy).

### SB10 · Finish · round summary
- Green hero: "Round complete" overline, tournament name + course/date meta,
  3-up score strip **Gross / Points (accent-filled) / To HCP**.
- "You finished 2nd · 38 pts" card (trophy icon tile + one-line takeaway).
- **Final standings table** — same card/table styling as SB9, columns
  **Pos/Player · Gross · Nett · Points** (Nett column added this session so the
  finish screen matches the mid-round leaderboard's three score facets; header
  label reads "Final standings · points"). Column widths: Player `flex:1`,
  Gross 38px, Nett 38px, Points 52px. Row treatment identical to SB9 (winner
  cream, your row green tint, alternating white/cream otherwise).
- "Best gross" strip: green card, emblem watermark, `award` icon tile, overline
  + winner's gross-to-par line.
- Actions: "Scorecard" (outline) / "Done" (solid green) side by side.

## Interactions & Behavior
- **SB1** format cards and round-structure toggle are single-select; selecting
  Stableford reveals the points-per-hole reference card (Stroke play does not
  show it — see the sibling Stroke Play flow instead).
- **SB3** tie-break rows and the handicap-allowance slider are editable;
  slider drag updates the live "95%" value and the "plays to handicap" points
  target.
- **SB6** Tee and Playing HCP fields are tappable editors (tee opens a picker;
  HCP is directly editable) — locked once the round starts per the info
  banner.
- **SB7** +/- stepper adjusts stroke count; quick-pick chips jump straight to a
  value; points are always **derived**, never entered directly. "Next hole"
  advances the hole navigator (prev/next chevrons also navigate holes).
- **SB8** Front 9 / Back 9 is a segmented toggle switching which 9 holes are
  shown in the grid.
- **SB9 / SB10** tables are static display — values are derived from the
  round's per-hole entries (see State Management).
- In-round bottom tab bar (SB6–SB9) switches between Scorecard / Leaderboard /
  Lobby / Finish; this nav persists across all in-round screens per
  `WIRE-UP.md` §2b.
- Motion: design-system defaults — `--dur-base` 200ms, `--ease-out`; buttons/
  pills depress to `scale(.985)` on press.

## State Management
No client state beyond form inputs (SB1/SB3) and per-hole score entry (SB7) is
introduced. Keep **per-hole gross-stroke entry as the single source of truth**;
derive everywhere else:
- **Nett score** = gross − handicap strokes received on that hole (from the
  player's Playing Handicap and the hole's stroke index).
- **Points** = points-per-hole table value looked up by nett score vs. nett
  par (Albatross 5 → Double+ 0, per SB1/SB3's table; allowance % from SB3
  scales the Playing Handicap used).
- **Leaderboard/finish standings** (SB9, SB10) = sort players by total points
  descending; ties broken by the tie-break rule chosen on SB3 (default:
  back-9/6/3/18th-hole countback).
- Playing Handicap = handicap index × slope/113 × the allowance % set on SB3,
  rounded — same derivation used by the Stroke Play flow (keep both formats
  consistent).

## Design Tokens (values used in this flow)
Colors:
- Fairway green (primary / headers / selected states): `#134914`
- Flag orange (accent — CTA, live-status dot, Points emphasis): `#FF914D`;
  soft variant `#FFC79E`
- Ink text: `#1C2B22`; muted `#8A958C`, `#5E6B62`
- Score-term colors: Albatross/Eagle gold `#C8971C`; Birdie orange `#D9772F`;
  Par green `#134914`; Bogey blue `#3B6FB0`; Double+ red `#C0392B`
- Under-par/positive `#1E8A4C`; negative/rank-down `#C0392B`; neutral `#B4BCB5`
- Surfaces: white `#fff`, winner cream `#FBF6E9`, "you" green tint `#F0F6EE`,
  sand `#FBF8F0`
- Borders: `#E3D9C0` (default), `#EFE8D5` (row separators), `#CDE3C8`
  (green-tint border)
- On-green whites: label `rgba(255,255,255,.72)`, overline `rgba(255,255,255,.6)`,
  separator `rgba(255,255,255,.14)`, divider `rgba(255,255,255,.2)`

Typography:
- Display (`--font-display`, Quicksand): hole number 28px/700, hole spec
  18px/700, section titles 16–20px/700
- Body (`--font-body`, Plus Jakarta Sans): labels 9–14px, subs 10–12px
- Numeric (`--font-numeric`, Space Grotesk, tabular): scores/points 12–64px

Radius: card `16px` (tables) / `14px` (strips/cards) / `18px` (score-entry
card), pill `999px`, icon tile `10–12px`.
Shadow: cards `0 4px 14px rgba(14,58,40,.06)`; pill `0 2px 8px
rgba(14,58,40,.22)`; CTA glow `0 6px 18px rgba(255,145,77,.4)` — warm
green-tinted throughout, never neutral grey.

## Screenshots
Reference captures of all seven screens are in `screenshots/` (each 720×1520, 2×):
- `SB1-format.png`, `SB3-stableford-rules.png`, `SB6-lobby.png`,
  `SB7-live-scoring.png`, `SB8-scorecard-grid.png`, `SB9-leaderboard.png`,
  `SB10-round-summary.png`.

## Assets
- `assets/golf-kaki-mark.svg` — emblem mark, used as the low-opacity header
  watermark on all in-round green headers (rendered white via
  `filter:brightness(0) invert(1)`).
- Icons: Lucide (2px stroke, `currentColor`): `list-checks`, `hash`,
  `calculator`, `shield-check`, `git-compare`, `handshake`, `target`,
  `table-2`, `crown`, `chevron-up`, `chevron-down`, `minus`, `award`, plus the
  shared status-bar/tab-bar icon set.

## Files
- `Golf Kaki Create Tournament - Stroke Play.dc.html` — the design reference
  (copied into this folder). Stableford screens are marked in source comments:
  `SB1 · FORMAT`, `SB3 · STABLEFORD RULES`, `SB6 · LOBBY`, `SB7 · LIVE SCORING`,
  `SB8 · SCORECARD GRID`, `SB9 · LEADERBOARD`, `SB10 · FINISH · ROUND SUMMARY`.
  (The file also contains the parallel Stroke Play flow, S1–S10 — not part of
  this handoff.)
- `WIRE-UP.md` (project root) — canonical file map, nav specification, and
  routing table; consult for how this flow's screens connect to the rest of
  the app (bottom nav, wizard steps 2/4 shared with Stroke Play, etc.).
- Design system: bound Golf Kaki Design System (tokens + components). Use its
  `Button`, `Avatar`, `ScoreBadge`/`scoreTerm`, `LeaderboardRow`, `Card`
  equivalents in the target codebase.
