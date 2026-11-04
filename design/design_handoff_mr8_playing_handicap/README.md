# Handoff update: MR8 Scorecard — playing handicap per round (auto vs manual override)

> **Track score · Add fun.** Golf Kaki multi-round tournament, Stroke play · Individual.

## What changed since the multi-round handoff

`design_handoff_multi_round/` specced **MR8 · Scorecard · round tabs** as the S8 grid plus a
round tab bar. This update adds the **playing handicap (Play HC / PH)** each player used, for
every round, and tells apart a handicap the app worked out from one that someone typed in.

Two additions, both on MR8 only:

1. **PH row** on the scorecard grid, directly under the player header. It shows each player's
   Play HC for the round in the active round tab.
2. **"Playing handicap by round" card** below the "Tournament · after R1" strip. One row per
   player, one column per round.

Each Play HC value is shown in one of two styles:

| Source | Meaning | Style |
|---|---|---|
| **Auto** | Calculated from the player's index and the tee (CR / Slope) at tee-off | Green chip |
| **Manual override** | Typed in by the player (own row) or the organiser (any row) in the lobby | Orange chip **plus pencil icon** |

The pencil icon is required, not decoration. It means the difference is still visible to
colour-blind users and in greyscale.

**Everything else on MR8 is unchanged**: the round tabs, Front/Back 9 toggle, view-only banner,
grid, score notation, R1 Gross / Nett / To par tiles, tournament strip, legend and bottom nav.

Screens are in `screens/` (2×, 720×1520 px). The full current prototype is in `design-files/`;
find the screen with the `MR8 · SCORECARD · ROUND TABS` HTML comment marker.

---

## MR8 · PH row (scorecard grid)
`screens/MR8-scorecard-ph-row.png`

- Placed between the player header row (avatar + name) and hole 1. It does not scroll away from
  the header: treat it as part of the header block.
- Row: min-height 30px, background `#FBF6E9` (sand-50 range), bottom border 1.5px `#E3D9C0`.
- Label cell: spans the H / Par / SI columns (90px). Lucide `flag` icon 11px `#C8971C`, then the
  text **`R{n} PH`** (e.g. `R1 PH`). Body font, 700, 10px, uppercase, letter-spacing .05em,
  `#9A6B12`.
- Player cells: same `flex:1` columns as the grid. The current user's column keeps the
  `rgba(19,73,20,.05)` tint. Each cell holds one **PH chip** (spec below).
- `{n}` and the values follow the active round tab. On the R2 tab it reads `R2 PH` with R2 values.

## MR8 · "Playing handicap by round" card
`screens/MR8-ph-by-round-card.png`

- Card: white, border 1.5px `#E3D9C0`, radius 12px, margin-top 8px, overflow hidden.
- Title row: `flag` icon 12px `#C8971C` + overline **"PLAYING HANDICAP BY ROUND"** (body 700,
  10px, letter-spacing .06em, `#8A958C`).
- Column header: `PLAYER` (flex) then one 44px column per round (`R1`, `R2`, `R3`, …). The
  round currently being viewed has its header in `#134914`; the others are `#A89B7C`.
  9px, 700, uppercase.
- Player rows: avatar 18px (player colour) + first name (12px; "You" in 700 `#134914`, others
  600 `#1C2B22`). Row padding 6px 12px, top border 1px `#EFE8D5`. The current user's row has a
  `#F0F6EE` background.
- Round cells: one **PH chip** each, centred in the 44px column.
- **Rounds without a Play HC yet** (not started / not set up) show `TBC` in body 11px `#A89B7C`.
  Players marked **DNS** for a round should show `DNS` in the same muted style (not drawn — same
  cell, label swap).
- Footer legend: background `#FBF6E9`, top border 1px `#EFE8D5`, 8px 12px padding, 10px body
  text `#5E6B62`. Two keys: green swatch **"Auto · from index at tee-off"** and orange swatch with
  pencil **"Manual override"**. Swatch: 12px, radius 3px, the chip's own fill and border.
- Number of round columns = `tournament.roundsCount` (2–5). At 5 rounds the columns still fit at
  44px within the 360px frame.

## PH chip — component spec

Shared by the PH row and the card. Inline-flex, centred, min-width 28px, height 22px,
padding 0 5px, radius 6px, border 1.5px, Space Grotesk 700 13px (tabular).

| Variant | Text | Fill | Border | Extra |
|---|---|---|---|---|
| Auto | `#1E6B3C` | `#EAF4E8` | `#CDE3C8` | — |
| Manual | `#B4561A` | `#FFF1E6` | `#F4C9A6` | Lucide `pencil` 9px after the number, gap 2px |

Accessibility label suggestion: "Playing handicap 9, manual override" / "Playing handicap 13,
automatic".

---

## Behaviour & data

- **Auto Play HC** = round(Index × Slope ÷ 113 + (CR − Par)) × allowance (95%), as already
  specced in the multi-round handoff. It is recalculated per round from that round's tee and the
  player's index at tee-off, which is why it can differ between rounds.
- **Manual override** happens in the lobby (MR6a / MR6b, the existing pencil "Play HC" box):
  the player edits their own, and the organiser can edit anyone's, until the first score of that
  round is entered. MR8 itself is **read-only**. No editing from the scorecard.
- If a player's tee or the round's course changes after an override, keep the manual value and
  keep the manual style. *(Confirm with design: alternative is to drop the override and
  recalculate.)*
- Once a round's first score is entered its Play HC is locked. The chip style shows how it was
  set at lock time.
- The handicap-stroke dots in the grid must come from the **same** Play HC shown in the PH row
  for that round (auto or manual).

Data model addition to `RoundPlayer` (from the multi-round handoff):

```
RoundPlayer { playerId, tee, cr, slope,
  playHc,                       // the value used for scoring
  playHcAuto,                   // what the formula gave, kept for reference / reset
  playHcSource: 'auto'|'manual',
  playHcOverriddenBy?,          // userId of player or organiser
  playHcOverriddenAt?,
  holeScores[18] }
```

`playHcSource` drives the chip variant. Setting a manual value equal to `playHcAuto` may be
saved as `'auto'`. *(Confirm with design.)*

## Sample data in the screens

All values are sample data. R1: You 13 (auto), Daniel 9 (manual), Jason 20 (auto).
R2: You 12 (auto), Daniel 9 (auto), Jason 21 (manual). R3: TBC.

## Design tokens

Same token set as `design_handoff_multi_round/design-system/`. The only new colours are the chip
fills and borders above. Auto uses the green family (`--green-50`-range fill, `#CDE3C8` soft
border). Manual uses the orange family (`--orange-100`-range fill, `--orange-700`-range text),
matching the existing "changed" accent `#C4621F` used elsewhere.

## Files

| Path | Contents |
|---|---|
| `README.md` | This file |
| `screens/MR8-scorecard-ph-row.png` | MR8 top: round tabs + PH row on the grid, 2× |
| `screens/MR8-ph-by-round-card.png` | MR8 scrolled: "Playing handicap by round" card + legend, 2× |
| `design-files/Golf Kaki Create Tournament - Stroke Play.dc.html` | Current prototype, all flows on one canvas. Find MR8 via its comment marker. Opens correctly only when placed back in the project root (it loads `./support.js` and `_ds/`). Otherwise use the PNGs. |
