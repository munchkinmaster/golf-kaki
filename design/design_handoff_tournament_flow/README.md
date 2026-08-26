# Handoff: Golf Kaki — Single-Round Tournament Flow (Stroke Play + Skins)

> **Track score · Add fun.** A golf scoring app that turns score-keeping into the best
> part of the weekend round. *Kaki* = Malay/Singaporean slang for a regular buddy.

## Overview
This bundle is the design handoff for the **create-and-play a single round** flow in
Golf Kaki: a host sets up a same-day round for a mixed-skill casual group, invites
players, everyone confirms tee + playing handicap, an optional **Skins** side game runs
alongside **Stroke Play**, scores are entered hole-by-hole, and the group sees a live
leaderboard, a full scorecard, a finish summary, and a read-only recap afterwards.

**Scope for this handoff: single round only.** The source prototype also contains two
multi-round tournament screens (`MR1 · Format · multi-round`, `MR2 · Rounds · schedule`)
— **ignore those.** Build the S1–S10 single-round flow plus the Past Game Recap.

## About the design files
The files in `design-files/` are **design references created in HTML** — interactive
prototypes showing the intended look, layout, copy, and behavior. **They are not
production code to copy directly.** Each is a "Design Component" (`.dc.html`) authored in
a custom prototyping runtime; they will not run standalone outside that runtime, so treat
them as **visual + structural specifications you read** (the inline `style="…"` on every
element *is* the spec), not modules you import.

Your task: **recreate these designs in the target codebase** using its existing framework
and patterns. If no app codebase exists yet, **React Native (Expo)** is the natural fit
given the all-mobile screens, but any modern mobile stack works. Wire the tokens in
`design-system/` into your theme first; everything else follows from them.

## Fidelity
**High fidelity.** Final colors, typography, spacing, shadows, and interactions. Recreate
pixel-faithfully using the tokens.

All screens are designed at a **360 × 760px** mobile frame. The phone bezel, the `9:41`
status bar, and the grey `S1 · Format` labels above each frame in the prototype are
**scaffolding — ignore them**; the app content area inside each frame is what you build.
Screens are laid out side-by-side on a canvas purely so a reviewer can see the whole
flow at once.

---

## Design tokens (source of truth)
Copied verbatim into `design-system/tokens/`. Load them into your theme.

### Color
| Token | Hex | Role |
|---|---|---|
| `--green-800` | `#134914` | **Primary** — fairway green. Hero cards, headers, primary buttons, brand text |
| `--green-900` | `#0E3A10` | Primary hover |
| `--green-50` | `#F0F6EE` | Brand-soft surface / selected fill |
| `#CDE3C8` / `#AED4A9` | — | Soft-green borders (cards, selected states) |
| `--orange-500` | `#FF914D` | **Accent** — flag orange. ONE per view: the single most important action / live indicator |
| `--sand-100` | `#F7F2E6` | **Default page background** (parchment) |
| `#FBF8F0` / `#FCFAF3` | — | Raised cream surface (highlighted rows) |
| `#FFFFFF` | — | Card surface |
| `--sand-300` | `#E3D9C0` | Default border |
| `#EEE8DA` / `#EFE8D5` | — | Hairline row divider |
| `--ink-900` | `#1C2B22` | Primary text (warm, green-tinted — never pure black) |
| `--ink-700` | `#3A4A40` | Secondary text |
| `--ink-500` | `#5E6B62` | Muted text |
| `#8A958C` / `#A89B7C` | — | Faint labels / SI numbers |

**Score-notation colors** (drive the per-hole score cells in the grid & recap):
| Term | Hex | Cell treatment |
|---|---|---|
| Birdie / under (−1) | text `#D9772F`, border `#F4A46A` | **circle** (border-radius 50%) |
| Par (even) | text `#1C2B22` | plain, no border |
| Bogey (+1) | text `#3B6FB0`, border `#B9CBE4` | **square** (border-radius 6px) |
| Double+ (+2 or worse) | text `#C0392B`, border `#E6B4AE` | **square** (border-radius 6px) |
| Handicap stroke received | dot `#1E8A4C` | small green dot(s) at top-right of the cell — one dot per stroke |

**Skins result colors:**
| Meaning | Hex |
|---|---|
| Skins won (positive net) | green `#1E6E16` on `#F0F6EE` |
| Skins lost (negative net) | burnt-orange text `#C2691C`, fill `#FDF0E3`, border `#F2D2AC` (deliberately **not** red — red is reserved for double-bogey scores) |

### Typography
| Role | Family | Usage |
|---|---|---|
| Display | **Quicksand** (400–700) | Headings, screen titles, big moments |
| Body | **Plus Jakarta Sans** | All UI / reading text |
| Numeric | **Space Grotesk** (tabular figures) | Scores, handicaps, SI, money, all numbers |

Set via CSS vars `--font-display` / `--font-body` / `--font-numeric`. Sizes seen in this
flow: 8–11px micro-labels/overlines, 13px body, 14–15px row text, 18–20px screen titles,
20–34px stat numbers. Overlines are ALL-CAPS with `letter-spacing:.06–.1em`; everything
else is **sentence case**. **No emoji** — Lucide line icons at 2px stroke do the icon work.

### Spacing, radius, shadow, motion
- **Spacing:** 4px base grid. Mobile side gutters **18px**. Tap targets **≥ 44px**.
- **Radius:** phone frame 36px · cards 14–16px · inputs/tiles 11–13px · buttons/chips/pills full pill (999px) · score cells 6px (square) or 50% (circle).
- **Shadow:** warm green-tinted, never grey — e.g. cards `0 4px 14px rgba(14,58,40,.06)`, frame `0 14px 44px rgba(14,58,40,.20)`, bottom sheets `0 -14px 40px rgba(14,58,40,.28)`.
- **Borders:** hairline sand (`#E3D9C0`). 1.5px standard control border. Green/soft-green border for emphasis, selection, and focus.
- **Motion:** quick + tactile. Bottom sheets slide from `translateY(100%)` → `0` over ~.28–.34s with `--ease-out`; scrims fade opacity. Row selection transitions bg/border over .18s.

---

## Screens — `Golf Kaki Create Tournament - Stroke Play.dc.html`

Flow order (single round): **S1 Format → S2 Course & tee → S3 Stroke-play rules →
S4 Players & invite (+ S4b edit handicap) → S5 Side games → S6b Pre-round confirm →
S6c In-round roster → S7 Live scoring → S8 Scorecard grid → S9 Leaderboard →
S10 Finish summary.** The Past Game Recap (separate file) is the after-the-round view.

### S1 · Format
Setup step 1. Parchment page, screen title, and a list of selectable **format cards**
(Stroke play selected). Each card: icon tile, name, one-line description, selected state
= soft-green fill + green border + check. Bottom primary CTA **Continue** (green pill,
with a right-arrow icon).

### S2 · Course & tee
Choose the course for the round (search + course cards: name, location, par/tee summary).
Selecting a course advances the setup.

### S3 · Stroke-play rules
Rules/config for stroke play: handicap allowance (e.g. nett 95%), tie-break rule, etc.,
shown as labelled rows. An **info bottom-sheet** (`toggleTbInfo`) explains the tie-break
rule — grab handle, title, body copy, scrim tap-to-close.

### S4 · Players & invite
The field. **Invite code** block (`GK-M4RK`) with copy + share affordances. Player rows:
avatar (colored initials disc), name, handicap **index**, a **tee chip** (colored dot +
tee name + chevron → opens tee picker) and an editable **Playing HC** tile (numeric,
pencil affordance). Host row is tagged **Host**.

- **S4b · Edit playing handicap (tapped state)** — the tap-to-edit variant: a bottom
  sheet over the dimmed players screen with a stepper to adjust that player's playing
  handicap. (Same sheet pattern as the tee picker.)

### S5 · Side games (optional)
Add an optional side game alongside stroke play. **Add side game** opens a **type-picker
sheet** (`toggleSgPick`): Skins / others. Choosing Skins opens the **Skins config sheet**
(`openSkinsCfg`): stake-per-hole stepper (`$5`, with quick presets), tie-hole rule
(carry over), last-hole-tie rule (split evenly), and a live "18 skins in play · $X pot"
line. Sheets support back (`backToSgPick`) and close.

### S6b · Round · pre-round (confirm / lobby)
The assembled round before it starts. Shows the field with per-player tee + playing
handicap, the locked format + side-game summary, and a start action. Players who joined
by mistake can be **swipe-to-removed** (red reveal behind the row on horizontal drag).

### S6c · Round · in-round (roster tab)
The in-round roster view (bottom tab bar: Scorecard / Leaderboard / **Lobby** / Finish).
Green header with round name + **invite code** + copy/share.
- **In the field** — player cards (avatar, name, index, tee chip, playing HC).
- **Side game · Skins** card — settings as read-only rows (stake, tied-hole, last-hole)
  plus an **"In the game"** row: overlapping avatar pills of who opted in + an "N of 4"
  count + a chevron. **Tapping this row opens the Skins-participation sheet**
  (`openSkinsWho`): every player listed with a **Playing / Add to pot** toggle; the pills
  and count on the card update live from the toggles. Note: "locked once the round starts."

### S7 · Live scoring
Per-hole entry for the current hole. Green header (hole number, par, SI, "thru" state).
Big current-hole stepper per player (or the active player), score recolors by golf term
as strokes vs par change. Advances hole-by-hole.

### S8 · Scorecard grid
Horizontally-scrollable hole-by-hole grid (front nine shown; holes as columns, players as
rows). Rows: **Hole** header (1–9 + OUT), **Par** row (soft-green pill), **SI** row (faint).
Each player row: avatar+name label (74px), then 9 score cells (27px each, 22px badge),
then OUT total (38px). Score cells use the notation colors/shapes above.
- **Handicap-stroke dots:** small green (`#1E8A4C`) dot(s) at the top-right of a cell mark
  holes where that player receives a handicap stroke — **two dots = two strokes** (e.g.
  the highest-handicap player on the SI-1 hole). Allocation follows the course stroke
  index: a player of course handicap H receives ⌊H/18⌋ strokes on every hole and one extra
  on holes whose SI ≤ (H mod 18).
- **Totals** row: Gross / Nett / To-par tiles (Nett tile is green-filled).
- **Legend:** Under par (circle) · Bogey (square) · Double+ (square) · **Handicap stroke**
  (green dot).

### S9 · Leaderboard
Green header (round name, THRU 18). Two sections:
1. **Stroke-play standings** — a horizontally-scrollable table with a sticky left
   Pos+Player column and **Gross / Nett / Total** columns shown side-by-side (no
   Gross/Nett toggle — all visible at once). Name column is 13px to avoid horizontal
   scroll; to-par color-coded.
2. **Skins results** — **per-player expandable breakdown** (not one shared board). Each
   player row shows their net skins; tapping expands a hole-by-hole detail of skins
   won/lost expressed as **counts, not dollars** (e.g. `+6`, `−1`, `0`). Lost skins use
   the burnt-orange palette (`#C2691C` text / `#FDF0E3` fill / `#F2D2AC` border) on both
   the hole cells and negative net totals.

### S10 · Finish · round summary
Green hero summary at the end of the round: winner/headline, each player's gross/nett/
to-par, skins settlement summary, and entry points to share / view the full scorecard /
view recap.

## Read-only recap — `Past Game Recap.dc.html`
Full-screen **read-only scorecard** reached from a "view scorecard" action on a completed
round. Same familiar S8-style grid, but **locked** with a "Round complete — view only"
banner. Header carries a **Gross / Nett segmented toggle**:
- **Gross** = raw strokes as played.
- **Nett** = gross minus handicap strokes, **recomputed per hole** from course handicaps
  (in the mock: You 14 / Marcus 9 / Jia Hui 18 / Dinesh 24) via stroke-index allocation.
  Green dots mark holes where strokes were received; Out/In/Total and the score notation
  adjust to the selected basis.

Stroke-allocation logic in the file (reuse it app-wide):
```js
const strokesOn = (hcp, si) => { let s = Math.floor(hcp / 18); if (si <= (hcp % 18)) s += 1; return s; };
```

---

## Interactions & behavior
- **Setup navigation:** S1 → S2 → S3 → S4 → S5 → S6b is a forward stack; each step's
  **Continue** (green pill + arrow) advances, back-chevron returns. The initial
  create-round entry uses a **Create tournament** CTA (trophy icon).
- **Bottom sheets** (tee picker, edit-handicap, side-game picker, skins config, skins
  participation, info sheets): scrim fades in; sheet slides up from the bottom; grab
  handle; tap scrim or close `x` to dismiss. Selecting an option updates state and (for
  pickers) closes the sheet.
- **Tee picker:** per-player; selecting a tee sets that player's tee (colored dot + name)
  and is intended to recompute their course/playing handicap from the tee's rating & slope.
- **Swipe-to-remove** (S6b): horizontal drag on a player row reveals a red delete action.
- **Skins participation** (S6c): tap "In the game" → sheet; toggle each player Playing /
  Add to pot; card pills + "N of 4" reflect the set live; locks once the round starts.
- **Skins results** (S9): tap a player row to expand/collapse their hole-by-hole skins.
- **Score entry** (S7/S8): score badge recolors by golf term (birdie/par/bogey/double)
  as strokes vs par change; Out/In/Total recompute live.
- **Recap Gross/Nett toggle:** switches every cell + the totals between raw and
  handicap-adjusted, re-deriving per-hole strokes on the fly.

## State management
Core domain state for a single round:
- **Round:** course (+ per-player tee), starting hole, format (stroke play + rules:
  handicap allowance, tie-break), optional side game (skins: stake, tie-hole rule,
  last-hole-tie rule, participant set), status (setup / pre-round / live / finished),
  invite code.
- **Players:** name, handicap **index**, per-round **playing/course handicap** (derived
  from tee rating/slope, editable), **skins participation** flag.
- **Scores:** per-player per-hole strokes → derived gross, nett (via `strokesOn`
  allocation over the course SI), to-par, Out/In/Total.
- **Skins:** per-hole win/carry/split resolution from scores + rules → per-player net
  skins count and hole-by-hole breakdown; leaderboard standings derive from scores.

Keep score entry as the single source of truth; derive the grid, leaderboard, skins
results, finish summary, and recap from it. `strokesOn(hcp, si)` is the shared
stroke-allocation primitive used by both the live grid dots and the recap Nett basis.

## Assets
- `assets/golf-kaki-mark.svg` — emblem crest. Avatars, low-opacity watermarks on green
  headers/hero cards (`filter: brightness(0) invert(1)` to render white on green).
- `assets/golf-kaki-logo-transparent.svg` — full logo for light surfaces.
- **Icons:** [Lucide](https://lucide.dev) at 2px stroke. Set used here: `trophy`,
  `users`, `list`, `circle-check-big`, `coins`, `chevron-left/right/down`, `x`, `plus`,
  `minus`, `pencil`, `copy`, `share-2`, `info`, `map-pin`, `circle-dot`, `flag`, `signal`,
  `wifi`, `battery-full`.
- **Fonts:** Quicksand, Plus Jakarta Sans, Space Grotesk (Google Fonts).

## Files in this bundle
```
design_handoff_tournament_flow/
├── README.md                                        ← this file (self-sufficient spec)
├── design-files/                                    ← HTML design references (read, don't ship)
│   ├── Golf Kaki Create Tournament - Stroke Play.dc.html  (PRIMARY — S1–S10 single-round flow + sheets)
│   └── Past Game Recap.dc.html                            (read-only recap scorecard, Gross/Nett toggle)
├── design-system/                                   ← THE design tokens (wire into your theme first)
│   ├── styles.css
│   └── tokens/  (colors · typography · spacing · radius · fonts · base .css)
└── assets/                                          ← brand SVGs
    ├── golf-kaki-mark.svg
    └── golf-kaki-logo-transparent.svg
```
> Note: the primary file also contains `MR1`/`MR2` multi-round screens — **out of scope,
> ignore them.** Build S1–S10 + the recap.

## Suggested first steps in Claude Code
1. Read this README end-to-end.
2. Translate `design-system/tokens/*.css` into your app's theme (a tokens module). Do this first.
3. Build the shared primitives: Button (green/accent pill), ScoreCell (notation
   circle/square + color by term + stroke dots), player Avatar, Card, tee chip,
   BottomSheet (scrim + slide-up), segmented toggle, TabBar.
4. Implement the setup stack (S1–S6b), then the in-round surfaces (S6c–S10), deriving
   the grid/leaderboard/skins/recap from a single scores store via `strokesOn`.
5. Wire the bottom sheets (tee picker, edit handicap, side-game/skins config, skins
   participation) and the recap Gross/Nett toggle last.
