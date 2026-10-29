# Handoff: Multi-round tournament (Stroke play · Individual)

## Overview
Extends the Golf Kaki single-round flow (S1–S10) into a **multi-round tournament**: an organiser creates a 2–5 round event, sets dates up front, configures only Round 1's course, and confirms each later round's course on the day (courses can change for traffic, maintenance, weather). Standings are an **aggregate nett total** across rounds. Players see the same lobby, set their own tee / Play HC before scoring, score each round with the existing S7–S9 screens, and get a recap after each round and a final summary at the end.

## About the design files
Files in `design-files/` are **design references created in HTML** — prototypes showing intended look, copy and behaviour, **not production code**. Recreate them in the target codebase's existing environment (React Native, SwiftUI, Flutter, etc.) using its established patterns. `Multi-Round Tournament.dc.html` opens in a browser only when placed back inside the original project (it references `../../_ds/` and `../../support.js`); use the PNGs in `screenshots/` as the visual reference otherwise.

## Fidelity
**High fidelity.** Final colours, type, spacing, copy. Recreate pixel-faithfully using the tokens in `design-system/`. All names, courses, scores and CR/Slope figures are sample data.

## Flow
```
MR1 Format ─► MR2 Rounds schedule ─(tap date)► MR2c date picker
              └─(tap R1 course)► MR2b Round 1 course & tee
          ─► MR3–5 Rules / Players / Side games (reused S3–S5) ─► Create
          ─► MR6a Lobby (before R1) ─► Start Round 1 ─► S7/S8/S9 (MR7–MR9 variants)
          ─► Finish ─► MR10 Round recap ─► Done ─► MR12 Home (tournament card)
On round day:
  Organiser: MR12 "Begin Round 2" ─► MR11 Set up round (course + who's playing) ─► Confirm & Next ─► MR6b Lobby
  Player:    MR12-P waiting ─► (organiser confirms, push) ─► MR12-P live "Join scoring" ─► MR6b / MR7
Repeat per round ─► after final round ─► MR13 Tournament complete
```

## Screens
All screens are 360×790 phone frames (radius 36px), parchment page `#F7F2E6`, 18px gutters, bottom CTA in a fade-to-page footer (`linear-gradient(to top, var(--surface-page) 70%, transparent)`).

### MR1 · Format · multi-round — `screenshots/01`
- Header: back chevron (44px white circle), title "Create a tournament", 4-step progress (1 Format · 2 Rounds · 3 Rules · 4 Players).
- Fields: Tournament name input; Play as (Individual selected green / Team disabled with "SOON"); Scoring format card "Stroke play (medal)".
- **Round structure** segmented: Single round / **Multi-round**. When Multi-round: **Number of rounds** pills 2 / 3 / 4 / 5 and **Standings** radio cards: "Aggregate total — Add every round — lowest combined nett wins" (default) / "Best N of rounds — Drop the worst round(s)".
- CTA: green pill "Continue →".
- Rule: number of rounds is fixed here; no adding rounds later.

### MR2 · Rounds · schedule — `02`
- Summary line: "Kaki Cup 2026 · 3 rounds · Stroke play · Individual · aggregate".
- One card per round: title ("Round 3 · Final" for the last), date chip (calendar icon + "Sat 11 Jul" + chevron) → MR2c.
  - Round 1: course row "Choose course · Required" → MR2b.
  - Later rounds: "Course on the day · Optional · add a planned course", or once planned: flag icon + "Sentosa GC · Serapong · Planned · confirm on the day".
- Info note: "Set the dates now so everyone can block them out. Only Round 1 needs a course now…"

### MR2c · Round date picker (bottom sheet) — `03`
- Title "Round 2 date", sub "After Round 1 · Sat 11 Jul", close X.
- Month calendar (Mon-first). Other rounds' dates are marked (R1, R2 tags). Dates before the previous round are greyed/disabled. Weekend columns tinted consistently by day-of-week.
- **No quick-pick pills** (+1/+2/+4 weeks removed) — calendar only.
- Note: "Dates before Round 1 are greyed out. Tee time is set on the day." CTA "Set Sat 25 Jul".

### MR2b · Round 1 · course & tee — `04`
- Title "Round 1 course", sub "Round 1 of 3 · Kaki Cup 2026 · Sat 11 Jul".
- Search, "Near you" list (radio rows with distance + hole count), "Which 18 to play" picker for 27-hole clubs, Default tee box segmented (Black / Blue / White / Red), note "Default for this round — players can still change their own tee", CR/Slope line. CTA "Save Round 1 ✓".
- Same component is reused as the course picker opened from MR11 "Change".

### MR3–5 · Reused steps — `05`
Reuse single-round S3 Rules, S4 Players, S5 Side games, with these differences:
- S3 adds "Rank on aggregate nett to par across all rounds"; allowance (95%) applies to every round.
- S4: one roster for the whole tournament; per-round attendance is set in MR11; absentees show DNS.
- S5: side games settle per round (skins / NTP reset each day).
- "Create tournament" → MR6a.

### MR6a · Tournament lobby · before R1 — `06`
- Green header: tournament name, "3 rounds · Stroke play · Nett 95%", status chip "R1 today", 3-segment round timeline (R1 · Orchid / R2 · Sentosa / R3 · Final).
- **Rounds** list: R1 "Ready" with course · holes · Par · default tee (editable pencil, organiser); R2 "Planned"; R3 "Course on the day".
- **Players** section header + hint "Tee shows CR / Slope · Play HC updates with tee", count "3 of 4 joined".
  - Row: avatar, name, "HCP 12.4 · Host"; **tee chip** (dot + tee name + chevron) with **CR / Slope beneath** in numeric 9px (e.g. "71.4 / 127"); **Play HC** box (numeric, pencil) labelled "Play HC".
  - Invited (not joined) row: "Tee & HC set when she joins", "Pending".
- Note: "Check your tee and Play HC before tee-off. The organiser can edit anyone's…"
- CTA orange "Start Round 1 ▶" (organiser). Bottom tabs: Scorecard · Leaderboard · Lobby · Finish.

### MR6b · Tournament lobby · round in progress — `13`
- Header chip "R2 · THRU 6"; timeline R2 highlighted with confirmed course.
- Rounds: R1 done (✓, "Low nett Daniel 63 · you 69"); R2 "Live · Tampines · Par 72 · Thru 6 · Locked — scoring has started".
- Players · Round 2: same row pattern as MR6a (tee chip + CR/Slope + editable Play HC). Non-playing player shows "Not playing this round" + **DNS** tag.
- No scores in the lobby — link "Scores & standings live in Leaderboard".
- CTA "Resume Round 2 · Hole 7 ▶".

### MR6 · Lobby · between rounds — `08`
Rounds list with R1 result summary, R2 "Not set up · Planned: Sentosa GC", compact Overall standings after R1, organiser CTA "Set up Round 2" → MR11.

### MR7 · Live scoring · tournament strip — `14`
S7 unchanged, plus a header line "Round 2 of 3 · Tanah Merah CC" and an **Overall strip** (trophy · "Overall −5 · 2nd · 5 back"). Stat tiles are per-round (R2 Gross / Nett / To par).

### MR8 · Scorecard · round tabs — `15`
S8 grid with a **round tab bar**: Round 1 (✓ done) / Round 2 · live (orange dot) / Round 3 (lock, disabled). Viewing a done round shows banner "Round 1 · Sat 11 Jul · view only" + link "Back to R2 →"; cells are not editable. Header chip "R1 FINAL". Summary: R1 Gross / Nett / To par + "Tournament · after R1 −3 · 2nd".

### MR9 · Leaderboard · overall — `16`
S9 with **Round / Overall** toggle. Overall: subtitle "Aggregate nett to par · 36 of 54 holes"; columns Pos · Player · R1 · R2 · Total; leader crown; movement arrows (e.g. ▲1). DNS row ranks last with "—" position and "Missed R2". Highlight card "Low round · R2". Note: "DNS players stay on the board but rank after everyone who has completed every round."

### MR10 · Round recap — `07`
Shown on Finish of each non-final round. Close X. Green hero: "Kaki Cup 2026 · Orchid CC · Sat 11 Jul", Gross / Nett / To par. Position line "2nd overall after Round 1 · 6 back of Daniel with 2 rounds to go." Overall table (Pos · Player · R1 · Total). "Up next" card: Round 2 date/time, planned course, note "Your organiser confirms the course… You'll get a notification when it's set." Buttons: **Scorecard** (→ MR8, secondary) · **Done** (→ MR12, primary green).

### MR11 · Set up next round · organiser — `12`
- Title "Set up Round 2", sub "Kaki Cup 2026 · Sat 25 Jul", pill "Host".
- **Course** card: flag tile, "Tanah Merah CC · Tampines", "Par 72 · CR 72.8 · Slope 131", link **Change** (→ MR2b-style picker titled "Round 2 course", planned course prefilled). If different from plan, footer row "⟲ Changed from plan: ~~Sentosa GC · Serapong~~".
- **Who's playing** (count "3 of 4"): name + switch per player. Off → "Not playing · will show DNS".
- **No tees or handicaps here** — they're set in the lobby where everyone sees the same screen. **No tee time.** No separate impact/confirm step (former MR11b merged and removed).
- Note: "Editable until the first score is entered. Players are notified when you confirm. Tees and handicaps are set in the lobby."
- CTA orange "Confirm & Next ✓" → sends push to players, opens MR6b-style lobby for that round.

### MR12 · Home · tournament card
Home screen (greeting, HCP, quick actions, Past games, tab bar) with a green **Tournament** card: overline "TOURNAMENT" + role pill, status line, tournament name, course, overall to-par + position, CTA. CTA depends on role and round state:

| Role / state | Status line | CTA | Goes to |
|---|---|---|---|
| Organiser (`09`) — pill "Organiser" | "Today · Round 2 of 3 · Tee off 7:00" | white pill "Begin Round 2" | MR11 |
| Player, not set up yet (`10`) — pill "Player" | course shows "· planned" | dashed, disabled "⌛ Waiting for Rahul to set up Round 2" | — |
| Player, set up but not started | same | "Open lobby" | MR6b |
| Player, round live (`11`) | "Live · Round 2 of 3 · Thru 4" | orange "Join scoring →" | MR7 |
| Player marked DNS | same | "View leaderboard" | MR9 |

(Open-lobby and DNS states are not drawn; same card, label swap.) No reminder copy or push banner on Home.

### MR13 · Tournament complete — `17`
Close X. Hero: champion avatar + crown, "Champion · Marcus (you) · −13 · 203 nett". Final standings table Pos · Player · R1 · R2 · R3 · Total (DNS shown in-cell, position "—"). Stat tiles: Low round, Best gross. "Rounds played" list with course per round and "changed on the day" flag where the course differed from plan. Buttons: Share (secondary) · Done (primary).

## Interactions & behaviour
- **Play HC** = round(Index × Slope ÷ 113 + (CR − Par)) × allowance (95%). Recompute whenever tee (CR/Slope) changes. Tee chip and Play HC update together.
- Tee and Play HC editable in MR6a/MR6b by the player (own row) and the organiser (any row) **until the first score of that round** is entered; then locked.
- MR11 changes (course / attendance) editable until first score is entered.
- Course change in MR11 recomputes everyone's Play HC from the new course's tee ratings; players see the result in the lobby.
- Scores save per hole; app can be closed and resumed from Home or lobby.
- Done rounds: view-only in MR8. Future rounds: tab disabled.
- **DNS** players remain on boards, rank after everyone who completed every round, show "DNS" in that round's column.
- Bottom sheets (MR2c, pickers): slide up from `translateY(100%)` over ~0.3s `--ease-out`, scrim fades in.

## State
```
Tournament { id, name, format:'stroke', play:'individual', roundsCount(2–5),
  standings:'aggregate'|'bestN', allowance:0.95, organiserId, roster:[playerId] }
Round { index, date, status:'planned'|'setup'|'live'|'done',
  plannedCourseId?, courseId?, holes(nine combo), defaultTee,
  attendance:{playerId: playing|dns}, firstScoreAt? }
RoundPlayer { playerId, tee, cr, slope, playHc, holeScores[18] }
```
- Derived: per-round gross/nett/to-par, aggregate total, positions + movement vs previous round, "changed on the day" = courseId ≠ plannedCourseId.
- Home CTA derived from `(isOrganiser, round.status, attendance)`.
- Push to players on MR11 confirm and on round start.

## Design tokens
In `design-system/tokens/` (colors, typography, spacing, radius/shadow/motion, fonts). Key values:
- Primary green `#134914` (hover `#0E3A10`, soft `#F0F6EE`, soft borders `#CDE3C8` / `#AED4A9`).
- Accent orange `#FF914D` — one per view (main CTA / live indicator), glow `0 6px 18px rgba(255,145,77,.35)`.
- Page `#F7F2E6`, card `#FFFFFF`, border `#E3D9C0`, ink `#1C2B22` / `#3A4A40` / `#5E6B62`, faint `#8A958C` / `#A89B7C`.
- Warning/info note: fill `#FDF2D6`-range cream with amber border; "changed" accent `#C4621F`.
- Score notation: birdie `#D9772F` circle · par plain · bogey `#3B6FB0` square · double+ `#C0392B` square · handicap-stroke dot `#1E8A4C`.
- Type: Quicksand (display), Plus Jakarta Sans (body), Space Grotesk (all numbers, tabular). Overlines uppercase, letter-spacing .06–.12em; otherwise sentence case. No emoji; Lucide icons at 2px stroke.
- Radius: frame 36 · cards 14–16 · inputs 11–13 · pills 999. Shadows warm green-tinted `rgba(14,58,40,…)`.

## Assets
- `assets/golf-kaki-mark.svg` — crest; avatars and low-opacity watermark on green hero cards (`filter: brightness(0) invert(1)` on green).
- Icons: Lucide (`flag`, `map-pin`, `calendar`, `trophy`, `crown`, `repeat`, `hourglass`, `lock`, `check`, `pencil`, `chevron-*`, `arrow-right`, `play`, `info`, `users`, `list`, `share-2`).

## Files
```
design_handoff_multi_round/
  README.md
  design-files/Multi-Round Tournament.dc.html   multi-round frames only (extracted from
                                                 "Golf Kaki Create Tournament - Stroke Play.dc.html")
  screenshots/01–17 *.png                        2× renders of every frame
  design-system/styles.css, tokens/*.css
  assets/golf-kaki-mark.svg
```
Single-round S1–S10 screens referenced here are documented in `design_handoff_tournament_flow/`.
