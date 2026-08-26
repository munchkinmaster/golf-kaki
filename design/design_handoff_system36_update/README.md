# Handoff update: Golf Kaki — System 36 now uses the standard tournament-creation flow

> **Track score · Add fun.** A golf scoring app that turns score-keeping into the best
> part of the weekend round. *Kaki* = Malay/Singaporean slang for a regular buddy.

## What changed since the last System 36 handoff

The earlier handoff (`design_handoff_system36/`) specced System 36 as its own
create-round-then-lobby flow: `SY1 Format → SY3 Rules → SY6 Lobby` (a live in-game screen
with the in-game bottom nav) `→ SY7 Live scoring → …`.

**System 36 has since been folded into the same multi-step tournament-creation wizard
already specced for Stroke Play** (see `design_handoff_tournament_flow/`): **Format →
Course → Rules → Players → Side games → Created**. Two screens are affected:

- **`SY4` is new.** A "Players & invite" step — was not part of the original 10-screen
  handoff.
- **`SY6` changed meaning.** It used to be the in-game **Lobby tab** (reached after the
  round had started, carrying the in-game bottom nav). It is now **"Review & create"** —
  the last step of tournament creation, reached *before* the round starts, with no bottom
  nav and a "Create & start scoring" CTA instead.

**Everything else in the old handoff is unchanged and still correct**: the System 36
scoring rules (`36 − points` handicap, per-hole 2/1/0 points, Stableford settlement),
`SY7` live scoring, `SY8`/`SY8b`/`SY8c` scorecards, `SY9`/`SY9b` leaderboard, and `SY10`
finish summary. Don't re-read this whole format's mechanics — refer back to
`design_handoff_system36/README.md` for those; this file only covers the delta.

Screens are in `screens/` (2×, 720×1520px). The full current prototype is in
`design-files/`; find both screens via their `SY4`/`SY6` HTML comment markers.

---

## SY4 · Players & invite · no HCP
`screens/SY4-players-invite.png`

**Purpose:** step 4 of tournament creation — build the field before reviewing.

Sections top to bottom:

- **Tournament summary chip** — green card, trophy icon, tournament name + `System 36 ·
  Individual · Orchid CC` meta line. Same pattern as the Stroke Play flow's players step.
- **Tournament code** — `GK-SAT9` in the numeric typeface, dashed green card, copy + share
  icon buttons. Reused from the Stroke Play players step.
- **No-handicap callout** — orange/sand card: *"No handicaps to set — System 36 works
  each player's handicap out from the round."* This is the one System-36-specific note on
  this screen; everything else is the shared players-step pattern.
- **Field** — host card (no tee-edit chevron reduction — host still picks a tee), joined
  players, and a pending-invite row (dashed border, "Invited" pill, "Waiting to join · tee
  set when they accept"). Progress header shows step 4 of 4 active (all four dots green).
- **From your kaki list** — quick-add rows with a `+` button, same as Stroke Play.
- **Continue** — orange pill CTA, advances to `SY6`.

Note there is **no playing-handicap field anywhere on this screen** — that's the point of
System 36. Tee assignment still happens per player (the dropdown chip), since tee has
nothing to do with handicap derivation.

## SY6 · Review & create
`screens/SY6-review-create.png`

**Purpose:** final review before the round is created and goes live. **Not** the in-game
Lobby — build this as a creation-flow screen, not a round screen.

Header: green bar, tournament name + `System 36 · Individual`, a **`NOT STARTED`** status
chip (clock icon) — contrast this with the old `SY6`'s live `THRU 6` chip, which belonged
to a round already in progress. Invite code + copy/share repeat here for convenience.

Body, top to bottom:

- **Round details** card — Course, Date, Field row (`4 players · 1 flight`).
- **No-handicap callout** — same message as `SY4`, restated here since this is the last
  chance to review before creating.
- **How scoring works** — the same two reference cards from the old `SY6`/`SY3` (System 36
  points per hole, Stableford points per hole) — unchanged, still shared components.
- **Who's playing** — field list, but **read-only**: shows each player's handicap **index**
  (`Index 12.4` etc.) as reference info only, tee chip, Host badge. **No "Play HC" pencil
  field** — the old `SY6`'s editable playing-handicap chip is gone, because System 36 never
  takes an entered handicap.
- **Format & rules** card — Format / Winner / Tie-break / Scoring rows, plus an info
  callout: *"Format locks once the round starts. Handicaps are derived at the end, then
  Stableford points are settled."*

Footer: a secondary pencil-icon button (back to edit) beside the primary orange **"Create
& start scoring"** CTA — this is what actually creates the tournament and transitions into
live play (`SY7`).

---

## Implementation note

If `SY6`'s old in-game-Lobby behavior (live status chip, per-player editable Play HC,
in-game bottom nav) was already built from the previous handoff, **that screen should be
removed** for System 36 — there is no in-game Lobby tab for this format anymore. Players
review everything on the new pre-creation `SY6`; once live, navigation goes straight to
`SY7` Scorecard / `SY9` Leaderboard (locked) / Finish, same in-game nav as other formats,
just without a Lobby tab (or with Lobby pointing back to a read-only version of this
review card — confirm which with design before building).

## Files

| Path | Contents |
|---|---|
| `design-files/Golf Kaki Create Tournament - Stroke Play.dc.html` | Current prototype, all formats on one canvas. Find `SY4`/`SY6` via comment markers. |
| `design-files/assets/` | Brand SVGs referenced by the screens |
| `design-system/` | Same token set as the original System 36 handoff — unchanged |
| `screens/*.png` | `SY4`, `SY6` only — the two changed/new screens, 2× |
