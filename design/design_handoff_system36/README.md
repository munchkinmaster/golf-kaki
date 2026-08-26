# Handoff: Golf Kaki — System 36 Scoring Format

> **Track score · Add fun.** A golf scoring app that turns score-keeping into the best
> part of the weekend round. *Kaki* = Malay/Singaporean slang for a regular buddy.

## Overview

This bundle is the design handoff for the **System 36** scoring format in Golf Kaki: a
self-handicapping format for groups where players don't have an official handicap index.
Players enter gross strokes as normal; the app awards System 36 points per hole, derives
each player's handicap from those points at the end of the round, and settles the result
on Stableford points off that derived handicap.

Scope covers ten screens, `SY1` → `SY10`: format selection, rules explainer, lobby, live
scoring, three scorecard states, two leaderboard states, and the finish summary.

**Out of scope for this handoff.** The source prototype also contains the Stroke Play
flow (`S1`–`S10`), a Stableford variant (`SB1`–`SB10`), and two multi-round screens
(`MR1`, `MR2`). Those are separate handoffs — build only the `SY` screens here. Where an
`SY` screen reuses a pattern from those flows it is called out below.

---

## About the design files

The file in `design-files/` is a **design reference created in HTML** — an interactive
prototype showing intended look, layout, copy, and behavior. **It is not production code
to copy directly.** It is a "Design Component" (`.dc.html`) authored in a custom
prototyping runtime and will not run standalone outside it, so treat it as a **visual and
structural specification you read** — the inline `style="…"` on every element *is* the
spec — not a module you import.

Your task: **recreate these designs in the target codebase** using its existing framework
and patterns. If no app codebase exists yet, **React Native (Expo)** is the natural fit
given the all-mobile screens, but any modern mobile stack works. Wire the tokens in
`design-system/` into your theme first; everything else follows from them.

The prototype file contains all Golf Kaki formats side by side on one canvas. Find the
System 36 screens by searching for the HTML comment markers, e.g.
`<!-- ============ SY8b · SCORECARD GRID · ROUND FINISHED ============ -->`.

## Fidelity

**High fidelity.** Final colors, typography, spacing, shadows, and interactions. Recreate
pixel-faithfully using the tokens.

All screens are designed at a **360 × 760px** mobile frame. The phone bezel, the `9:41`
status bar, and the grey `SY8b · Scorecard · round finished` labels above each frame are
**scaffolding — ignore them**. The white annotation card *below* each frame is also
scaffolding: it is design commentary explaining a decision, useful to read but not to
build. The app content area inside each frame is what you build.

Screens sit side-by-side purely so a reviewer can see the whole flow at once.

---

## The format: how System 36 works

Implement this correctly and the screens follow. Getting it wrong is the main risk in
this handoff, because the rules are unlike the other formats in the app.

**Per-hole points (gross-based, no handicap needed):**

| Result on the hole | S36 points |
|---|---|
| Par or better | 2 |
| Bogey (1 over) | 1 |
| Double bogey or worse | 0 |

**Handicap:** `handicap = 36 − (total S36 points)`. In this design the sum is over 18
holes, and this is the number that settles the round.

**Result:** allocate that handicap across the 18 holes by stroke index, compute nett per
hole, and score Stableford off nett. Most Stableford points wins.

So a round produces two point totals with different jobs: **S36 points earn the
handicap**, **Stableford points decide the win**. The UI must never conflate them.

### Three rules the screens depend on

**1. No strokes are applied per hole during play.** Unlike Stroke Play with a playing
handicap, System 36 gives out no strokes as you play — the allocation only exists once
the handicap is known. This is why `SY7` and `SY8` show no stroke-receive pips, and why
`SY6` tells players there is no handicap to enter.

**2. Nett and Stableford are not shown until 18 holes are complete.** They are muted
placeholders mid-round (see `SY8`). Two reasons, both worth preserving:

- A part-round nett requires allocating the handicap per hole and counting only the
  strokes falling on holes played. Subtracting a whole-round handicap from a part-round
  gross is wrong and was explicitly rejected during design.
- The number moves counter-intuitively. A bad hole *lowers* S36 points, which *raises*
  the handicap, which can *improve* nett. Showing it mid-round invites mistrust.

**3. The live handicap shown mid-round is current, not projected.** `S36 hcp` mid-round is
`36 − points so far`, a true value as of the holes played, not an extrapolation of pace.
It starts high and falls as points accumulate. An earlier pace-based projection was
designed and deliberately removed — do not reintroduce it.

### Known property to expect

System 36 is self-equalising: a player scoring well earns more S36 points and therefore a
*lower* handicap, so final Stableford totals cluster tightly around 36. Expect narrow
finishes and mid-round order that reorders at the end. This is the format working
correctly, and it is the reason the mid-round leaderboard is locked (below).

---

## Screens

Screenshots are in `screens/`, at 2× (720 × 1520px).

### SY1 · Format · System 36 selected
`screens/SY1-format.png`

**Purpose:** host picks the scoring format when creating a round.

Reuses the `S1 · Format` screen from the Stroke Play handoff — same list of format cards,
same selected-card treatment (green border + brand-soft fill). Only difference: the
**System 36** card is the selected one, and its supporting line explains self-handicapping.

### SY3 · System 36 rules
`screens/SY3-rules.png`

**Purpose:** explain the format before the round starts.

Two reference cards, stacked:

1. **System 36 points per hole** — the 2 / 1 / 0 table, with the result names spelled out.
2. **Stableford points per hole** — the nett-based table used for the final result.

Both use white cards (`#fff`), `1.5px solid #E3D9C0` border, `16px` radius, on parchment.
Row labels in body font at 12px `#5E6B62`; the point values in the numeric font, 700.

These same two cards are reused verbatim in the lobby (`SY6`) — build them as one shared
component.

### SY6 · Lobby · no HCP to enter
`screens/SY6-lobby.png`

**Purpose:** pre-round staging — who's playing, and how scoring works.

Sections top to bottom:

- **Callout: no handicaps to enter.** Explains that System 36 derives each handicap from
  play, so there is nothing to enter now. This is the key difference from the Stroke Play
  lobby, where each player confirms a playing handicap.
- **"How scoring works"** overline (`11px`, `600`, `letter-spacing: .1em`, `#5E6B62`,
  uppercase) followed by the two rule cards from `SY3`. Added so players can re-read the
  rules mid-round without leaving the round — the lobby is reachable throughout.
- **Field** — the player list.

Note: the callout and the first rule card both state the `36 − points` rule. Consider
trimming the callout's second sentence when you build it.

### SY7 · Live scoring · points build HCP
`screens/SY7-live-scoring.png`

**Purpose:** enter gross strokes for the current hole.

Same scoring interaction as the Stroke Play `S7` screen — hole header, par/SI/distance
line, big stroke stepper, player rail. System 36 differences:

- A **running S36 points** readout, showing points earned so far.
- The per-hole meta line reads `388m · strokes at the finish` — stating *when* strokes
  apply rather than that none do.
- **Projections are suppressed pre-turn.** `Proj HCP` and `Proj Stbf` render as dashed
  `—` tiles with a lock caption: projections open at hole 9. This was a deliberate
  decision — pre-turn projections carry too little information to show. Note this screen
  is frozen at hole 7 in the prototype, so only the suppressed state is drawn; from hole
  9 the same tiles carry values.

The single orange accent on this screen belongs to the **+stroke** control. Do not add a
second orange element.

### SY8 · Scorecard · mid-round (thru 9)
`screens/SY8-scorecard-midround.png`

**Purpose:** the group's card while the round is in progress.

Transposed grid: **holes as rows, players as columns** (`You`, `Daniel`, `Jason` in the
prototype data). Columns: hole number, par, SI, then one column per player. Each cell is
the gross stroke with score notation (see *Score notation* below). No stroke-receive pips
— nothing is allocated yet.

**Totals row — the important part.** Caption above reads `As it stands · thru 9` with an
activity icon. Then two rows of tiles:

| Row | Tiles |
|---|---|
| 1 | `Gross 42` (filled green, active) · `Nett —` (muted, dashed) · `S36 pts 12` (neutral white) |
| 2 | `S36 hcp 24` (neutral white) · `Stbf pts —` (muted, dashed) |

- **Live:** Gross, S36 pts, S36 hcp. `S36 hcp` is `36 − 12 = 24` and drops as points come in.
- **Muted until 18:** Nett and Stbf pts — dashed `1.5px` border, `#FBF8F0` fill, `#8A958C`
  label and em-dash value. Tile positions match `SY8b` exactly so nothing shifts when
  they fill in.

Footnote below the grid: `12 pts thru 9 → handicap 24 (36 − 12). Nett and Stableford open
once all 18 holes are in.`

### SY8b · Scorecard · round finished (gross view)
`screens/SY8b-scorecard-gross.png`

**Purpose:** the settled card, gross basis.

Header chip switches from the live `THRU 9` pill to a **green `FINAL` tick** on white.
Caption reads `Final · 18 holes · gross`.

Grid shows gross strokes with the S36 2/1/0 points that earned each handicap. **No stroke
pips on this view** — nothing is spent here. Summary rows: `Out` and `S36 pts`.

Totals tiles:

| Row | Tiles |
|---|---|
| 1 | `Gross 82` (filled green, **active**) · `Nett 70` (white, **tappable**) · `S36 pts 24` (neutral) |
| 2 | `S36 hcp 12` (orange, settled) · `Stbf pts 37` (orange, settled) |

Legend: `Birdie+ (2 pt)` · `Par (2 pt)` · `Bogey (1 pt)` · `Double+ (0 pt)`.

### SY8c · Scorecard · nett view
`screens/SY8c-scorecard-nett.png`

**Purpose:** same finished card, nett basis — the view that explains where the result came from.

**This is not a separate screen.** `SY8b` and `SY8c` are one screen with two views. The
**Gross / Nett tile pair in the totals row is the switch**: the active view's tile is
filled green, the inactive one is white with `cursor: pointer`. Tapping swaps them. There
is no segmented control above the table and no toggle in the header — both were tried and
rejected.

Differences from the gross view:

- Cells show **nett** strokes with nett score notation.
- **Green stroke-receive pips** (`4px` circle, `#1E8A4C`, top-right of the cell) on holes
  where that player received a stroke, one pip per stroke.
- Summary rows become `Nett out` and `Stbf pts`.
- Legend becomes `Nett birdie+` · `Nett par` · `Nett bogey` · `Nett double+`, plus a pip
  note: `Stroke received — dots show strokes given on that hole`.
- Caption reads `Final · 18 holes · nett`.

Only `Gross` and `Nett` swap state. `S36 hcp` and `Stbf pts` keep the settled orange
treatment in both views.

**Allocation, from the prototype data.** Course front nine `par [4,4,3,5,4,4,4,3,5]`,
`SI [5,11,15,1,7,3,9,17,13]`:

| Player | Handicap | Strokes on this nine |
|---|---|---|
| You (Marcus) | 12 | SI 1–12 → holes 1, 2, 4, 5, 6, 7 (6 of 12) |
| Daniel | 3 | SI 1 and 3 → holes 4 and 6 |
| Jason | 21 | 1 everywhere + a 2nd on SI 1 and 3 → 11 |

General rule: `strokes(hole) = floor(H / 18) + (SI(hole) <= H mod 18 ? 1 : 0)`.

### SY9 · Leaderboard · locked until 18
`screens/SY9-leaderboard-locked.png`

**Purpose:** the Leaderboard tab is reachable during the round, but shows no standings.

**Decision: no mid-round standings at all.** A provisional board ranked on running S36
points was designed and rejected — positions shift for reasons players can't see, and a
crisp 1/2/3/4 overclaims. Instead:

- Bottom-nav **Leaderboard** tab renders muted grey (`#8A958C`) with a small **lock badge**
  on the trophy icon.
- Screen content, centred: an 84px circular plate (`#F0F6EE` fill, `1.5px #CDE3C8` border)
  with a trophy icon and a lock sub-badge; headline **"Standings open at 18"** (display
  font, 700, 21px, `#134914`); one line of body copy; a primary green **"Back to
  scorecard"** button (46px pill).
- Header chip reads `LOCKED` with a lock icon, in muted white-on-green.

Static screen by design — no progress bar, no live "x of y finished" counts. Keep it that
way for the first build.

Copy states *when* it opens, not that it is unavailable.

**Two implementation notes.** The lock should release when **the last card is in**, not
when the viewing player finishes — otherwise early groups see a half-empty board and
assume they have won. And note the scorecard (`SY8`) still shows every player's gross and
S36 points, so who is playing well remains inferable: locking the leaderboard removes the
false precision of ranked positions, not the underlying information. That was an accepted
trade-off, not an oversight.

### SY9b · Leaderboard · final Stableford
`screens/SY9b-leaderboard-final.png`

**Purpose:** the settled result.

Ranked table, horizontally scrollable, with a sticky left column (160px: position,
avatar, name). Columns: `Gross`, `S36`, `HCP`, `Stbf`. **Stableford is the ranking metric
and carries the accent**; S36 points demote to supporting data. Crown and gold treatment
appear here only.

Header row is green (`#134914`) with `9px` uppercase labels at `rgba(255,255,255,.72)`;
the active `Stbf` column label uses the accent tint. Rows alternate `#fff` / `#FBF8F0`,
with the viewing player's row tinted `#F7FBF5` and their name in `#134914`.

Explainer beneath: *System 36 points set each handicap; Stableford points decide the win.*

Note the compression in the prototype data — 38 / 37 / 34 / 31, four players inside 7
points, and the S36 leader wins by one. Expect this shape.

### SY10 · Finish · Stableford summary
`screens/SY10-finish-summary.png`

**Purpose:** end-of-round summary for the player.

Follows the `S10` / `SB10` summary pattern — green hero card with the emblem watermark at
low opacity, the headline result, a stat row, then a share action. System 36 specifics:
the hero states the **derived handicap** alongside the Stableford total, so the player
sees both numbers the format produced.

---

## Interactions & behavior

| Interaction | Behavior |
|---|---|
| Format select (`SY1`) | Tapping a format card selects it; green border + brand-soft fill. Single select. |
| Stroke entry (`SY7`) | `+`/`−` stepper on the current hole; orange `+stroke` is the single accent. Advancing hole recomputes S36 points immediately. |
| Projection unlock (`SY7`) | `Proj HCP` / `Proj Stbf` are dashed `—` before hole 9; values from hole 9. Drive from one `holesPlayed` value shared with `SY8` so the two screens cannot disagree. |
| Gross / Nett switch (`SY8b` ⇄ `SY8c`) | Tapping the inactive tile swaps views. Only the finished card has this — mid-round has no nett view to switch to. |
| Leaderboard tab (during round) | Navigates to the locked screen (`SY9`). Tab is visibly disabled — muted + lock badge — but still tappable, so the tap lands somewhere that explains itself. |
| Leaderboard unlock | Releases when the last card is in, then `SY9b`. |
| Scorecard grid scroll | Horizontal scroll with sticky hole/par/SI columns. |
| Press states | Buttons depress `scale(0.985)`; `--dur-base` 200ms, `--ease-out`. |

**Only inactive Gross/Nett tiles carry `cursor: pointer`.** No other totals tile is
tappable — do not add hover or pointer affordance to `S36 pts`, `S36 hcp`, or `Stbf pts`.

## State

| State | Type | Notes |
|---|---|---|
| `holesPlayed` | `int 0–18` | **Single source of truth.** Drives projection unlock, nett/Stbf suppression, captions, and header chip across `SY7`, `SY8`, `SY9`. Do not duplicate per screen. |
| `grossStrokes[player][hole]` | `int` | The only user-entered scoring data. |
| `s36Points[player][hole]` | derived | `2 / 1 / 0` vs par. |
| `s36Handicap[player]` | derived | `36 − sum(s36Points)`. Live mid-round, settled at 18. |
| `strokesReceived[player][hole]` | derived | From `s36Handicap` + SI. Only valid at 18. |
| `nett[player][hole]`, `stableford[player][hole]` | derived | Only surfaced at 18. |
| `scorecardView` | `'gross' \| 'nett'` | Finished card only; defaults to **nett** — the view that explains the result. |
| `leaderboardUnlocked` | `bool` | True when all cards are in. |

Everything except `grossStrokes` and the two view flags is derived — compute, don't store,
so the screens cannot drift apart.

## Score notation

Shared with the other Golf Kaki formats — reuse the existing component if it exists.

| Result | Treatment |
|---|---|
| Eagle or better | Double circle, gold |
| Birdie | Circle, `1.5px solid #F4A46A` |
| Par | Filled circle `#134914`, white numeral |
| Bogey | Square, `1.5px solid #B9CBE4` |
| Double+ | Square, `1.5px solid #E6B4AE` |

On the nett view the same shapes apply to **nett** scores, with the legend relabelled
`Nett birdie+` etc.

**Stroke-receive pip:** `4px` circle, `#1E8A4C`, absolutely positioned top-right of the
cell, `1px` gap between multiple pips. Nett view only.

## Design tokens

Full token files are in `design-system/tokens/`; link `design-system/styles.css` for the
whole set. Values used in these screens:

**Brand**

| Token | Value | Use |
|---|---|---|
| `--green-800` | `#134914` | Primary — hero cards, primary buttons, table headers, brand text |
| `--orange-500` | `#FF914D` | Accent — **one per view**. Live indicators, the single most important action |
| `--sand-100` | `#F7F2E6` | Page surface (parchment) |
| `--surface-card` | `#fff` | Cards |
| — | `#FBF8F0` | Soft cream — alternating rows, muted tiles |
| — | `#1C2B22` | Ink (warm, green-tinted — never pure black) |

**Screen-specific**

| Value | Use |
|---|---|
| `#8A958C` | **The muted/unavailable text colour.** Labels and em-dashes on suppressed tiles, disabled tab. Use this — not a lighter grey — for anything demoted. |
| `#E3D9C0` | Hairline card border (`1.5px`) |
| `#EFE8D5` | Row divider, track fill |
| `#5E6B62` | Secondary body text, captions |
| `#FFF3E9` / `#F4C79B` / `#D9772F` / `#B65A1E` | Settled-value tile: fill / border / value / label |
| `#F0F6EE` / `#CDE3C8` | Locked-state plate: fill / border |
| `#F7FBF5` | Viewing player's row tint |
| `#1E8A4C` | Stroke-receive pip |
| `#FFF8EF` / `#F0D6B4` / `#7A4A18` | Warning callout: fill / border / text |

**Type** — Display **Quicksand**, Body **Plus Jakarta Sans**, Numeric **Space Grotesk**
(tabular figures; all scores, handicaps and point totals).

| Role | Spec |
|---|---|
| Screen title | Display 700, 18px |
| Locked headline | Display 700, 21px |
| Tile value | Numeric 700, 20px |
| Tile label | Body, 9.5px, `letter-spacing: .05em`, uppercase |
| Section overline | Body 600, 11px, `letter-spacing: .1em`, uppercase |
| Body / footnote | Body, 11–12.5px, `line-height: 1.45` |
| Table header | Body 700, 9px, `letter-spacing: .05em`, uppercase |

**Shape & elevation** — cards `16px`, tiles `12px`, buttons/chips/badges full pill
(`999px`). Shadows are **warm green-tinted** `rgba(14,58,40,…)`, never neutral grey:
cards `0 4px 14px rgba(14,58,40,.06)`, frames `0 14px 44px rgba(14,58,40,.20)`, accent CTA
gets an orange glow.

**Spacing** — 4px base grid. Screen gutters 18px. Tile gaps 7px. Tap targets ≥ 44px.

## Assets

| File | Use |
|---|---|
| `design-files/assets/golf-kaki-mark.svg` | Emblem — low-opacity watermark on green hero cards, avatars, app icon. On dark surfaces render with `filter: brightness(0) invert(1)`. |
| `design-files/assets/golf-kaki-logo-transparent.svg` | Full logo on light surfaces |

**Icons: [Lucide](https://lucide.dev)**, outline only, 2px stroke, inheriting
`currentColor`. Used here: `lock`, `trophy`, `activity`, `circle-check-big`, `list`,
`users`, `scale`, `hourglass`, `circle-dot`, `chevron-left`, `table-2`, `signal`, `wifi`,
`battery-full`.

This is a substitution — no brand icon set was provided. **No emoji.**

## Files

| Path | Contents |
|---|---|
| `design-files/Golf Kaki Create Tournament - Stroke Play.dc.html` | The prototype. All Golf Kaki formats on one canvas; find System 36 screens via the `SY…` HTML comment markers. |
| `design-files/assets/` | Brand SVGs referenced by the screens |
| `design-system/styles.css` | Design-system entry — link this one file |
| `design-system/tokens/` | `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `radius.css`, `base.css` |
| `screens/*.png` | Screenshots of all ten screens, 2× (720 × 1520) |

---

## Build order

1. **Tokens first.** Wire `design-system/tokens/` into the app theme.
2. **The scoring engine.** S36 points, `36 − points` handicap, SI allocation, nett,
   Stableford. Everything else reads from it. Test the self-equalising property — a
   better round should produce a lower handicap.
3. **`holesPlayed` as one shared value.** Every suppression rule in the UI derives from it.
4. **`SY7` live scoring**, then **`SY8`** mid-round card.
5. **`SY8b`/`SY8c`** finished card with the Gross/Nett tile switch.
6. **`SY9` locked** state and the disabled tab, then **`SY9b`** final board.
7. **`SY1`, `SY3`, `SY6`, `SY10`** — mostly reuse of existing patterns.

## Open questions

- **Lock release granularity.** "Last card in" — per group or per whole field? For a
  multi-group tournament these differ substantially.
- **Back nine.** The prototype's scorecard grid shows the front nine only. Confirm whether
  the back nine is a horizontal scroll continuation or a separate Out/In toggle.
- **Ties.** System 36's compression makes ties likely. No countback rule is specified in
  these screens.
- **Mid-round nett.** Deliberately deferred. If it is ever wanted, it must allocate per
  hole and count only strokes on holes played.
