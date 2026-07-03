# Golf Kaki — Wire-up Notes

Handoff map for building in Claude Code / VS Code. Tells you **which file is the
source of truth for each screen**, **how the bottom nav docks**, and **what each
button/action should route to**.

> **Rule of thumb:** the individual `*.dc.html` files below are the *current,
> canonical* spec. **`Golf Kaki Wireframes.dc.html`** is now the live master for
> the round flow + Home + in-game tabs (it carries all the latest work:
> notifications stack, in-game Lobby tab, Get/Give stroke convention, two-step
> progress labels). The older `Golf Kaki Hi-Fi.dc.html` is **original concept
> reference only** — it has drifted; when a screen exists elsewhere, that wins.

---

## 1. Canonical file per screen

| Screen | Source of truth | Notes |
|---|---|---|
| Landing | `Golf Kaki Wireframes.dc.html` → `01 · Landing` | Headline is "Golf Kaki" |
| **Home** | **`Golf Kaki Wireframes.dc.html`** → `02 · Home` | Nav docks here. Now leads with a **Notifications** stack (see §3). |
| **Profile** | **`Golf Kaki Profile.dc.html`** | ⚠️ Replaces the Wireframes `03`. Identity + trophy cabinet. Friends removed (now in Kaki). |
| **Kaki** (friends) | **`Golf Kaki Kaki Tab.dc.html`** | Friends + incoming requests + Add-friend sheet. |
| Add friend (modal) | `Golf Kaki Add Friend.dc.html` | Standalone reference; also embedded inside Kaki Tab. |
| Friend requests | — | **Folded into Kaki Tab** — build it there, not as a separate screen. |
| **Rounds** | **`Golf Kaki Rounds History.dc.html`** | Live / Past toggle. |
| Trophy cabinet (full) | `Golf Kaki Trophy Cabinet.dc.html` | "View all" target from Profile. |
| Select course | `Golf Kaki Wireframes.dc.html` → `04 / 04b` | Round-flow entry. 2-step progress: **1 · Course & holes**, **2 · Match details**. |
| Create game | `Golf Kaki Wireframes.dc.html` → `05 / 05b` | Step 2 of the progress bar. |
| **Join a game** | **`Golf Kaki Join Game.dc.html`** | Enter a `GK-` code or tap a kaki's live game. **Join → in-game Lobby tab** (the round you joined) — there is **no separate game-lobby screen**. |
| Match lobby (pre-round) | `Golf Kaki Wireframes.dc.html` → `06` | Has **Start round** CTA. |
| In-game scorecard | `Golf Kaki Wireframes.dc.html` → `07` | In-game bottom nav (see §2b). |
| Leaderboard | `Golf Kaki Wireframes.dc.html` → `08 / 09` | |
| **Lobby tab (in-game)** | **`Golf Kaki Wireframes.dc.html`** → `Lobby tab · In-game` | NEW. Same match info as `06` (players / strokes / stakes) but **no Start round button**; carries the in-game bottom nav with Lobby active. |
| Finish round | `Golf Kaki Wireframes.dc.html` → `10` | |
| Past game recap | `Golf Kaki Wireframes.dc.html` → `11` | Reached from Rounds. Now includes a **Carry-forward strokes** section after the scorecard. |

> **Removed:** the standalone **Game invite** detail screen (old `02b`). Accepting
> an invite now routes **straight into the in-game Lobby tab** — don't rebuild a
> separate invite-detail page.
>
> **Same rule for joining:** tapping **Join game** on `Golf Kaki Join Game.dc.html`
> routes **straight into the in-game Lobby tab** — there is **no** standalone
> post-join "game lobby" screen (a previous draft of one was removed).

---

## 2a. Bottom navigation — home base

**Build once as a single reusable component** (e.g. `<BottomNav active="..."/>`).
Do **not** copy it into each screen's markup. Source: `Golf Kaki Main Nav.dc.html`.

Order (left → right), Start is the centered accent:

| Item | Icon (Lucide) | Routes to |
|---|---|---|
| Home | `house` | Home (`02`) |
| Rounds | `flag` | `Golf Kaki Rounds History.dc.html` |
| **Start** | `circle-plus` (orange) | Select course (`04`) — begins the round flow |
| Kaki | `users` | `Golf Kaki Kaki Tab.dc.html` |
| Profile | `user` | `Golf Kaki Profile.dc.html` |

**Active:** green icon + label, `stroke-width:2.4`. Inactive: grey `#9AA59C`.
**Start** is always orange `#FF914D` (the one accent per view).

### Where the home-base nav shows / hides

- **SHOW** on home-base screens: **Home, Rounds, Kaki, Profile**.
- **HIDE** during the pre-round flow: **Select course, Create game, Match lobby**
  (`04`–`06`). These are immersive with their own back/forward controls.
- Past game recap (`11`) is reached *from* Rounds → keep nav shown.

## 2b. Bottom navigation — in-game

Once a round is **live**, the screen switches to a **separate 4-tab in-game nav**
(no Start accent). Tabs left → right:

| Item | Icon (Lucide) | Screen |
|---|---|---|
| Scorecard | `list` | `07 · In-game · Scorecard` |
| Leaderboard | `trophy` | `08 / 09` |
| Lobby | `users` | `Lobby tab · In-game` |
| Finish | `circle-check-big` | `10 · In-game · Finish` |

Active tab = fairway green `#134914` (icon + label, weight 600); inactive
`#B4BCB5`. This nav stays docked across all four in-game screens.

---

## 3. Home notifications stack

Home now opens with a **Notifications** section (orange count badge) above
"In play". Three card types, same shell (avatar/icon chip → title → meta row →
two action buttons), each with its own accent border + status pill:

| Card | Accent | Actions | Routing |
|---|---|---|---|
| **Game invite** | orange | Decline / Accept | **Accept → in-game Lobby tab** (the round you joined). Decline dismisses. |
| **Friend request** | green | Ignore / Accept | Accept moves person into Kaki → Friends; Ignore dismisses. |
| **Confirm score** | amber | View card / Confirm | View card → in-game Scorecard (`07`); Confirm marks your card submitted. |

---

## 4. Button / action routing (the dead-ends to fix)

| Screen | Element | Action |
|---|---|---|
| Profile | Settings gear (top-right) | → **Settings screen** *(not yet built — hold the route)* |
| Profile | Camera badge on avatar | Open photo picker / upload |
| Profile | Pencil by name | Inline edit name + @handle (Save/Cancel) — already in the DC |
| Profile | "Edit bio" | Inline bio textarea (Save/Cancel) — already in the DC |
| Profile | Trophy "View all" | → `Golf Kaki Trophy Cabinet.dc.html` |
| Kaki | "Add" button | Opens Add-friend bottom sheet (embedded in Kaki Tab) |
| Kaki | Request "Confirm" / "✕" | Moves person Requests → Friends / dismisses |
| Rounds | Live / Past toggle | Live = in-progress games, Past = history |
| Rounds | Past round cell | → Past game recap (`11`) |
| Rounds | Live game cell | → In-game scorecard (`07`) |
| Join a game | Join game (CTA) / live-game cell | → In-game **Lobby tab** — the round you just joined |
| Match lobby (`06`) | Start round | → In-game scorecard (`07`); round goes live |
| In-game Lobby tab | (no Start) | Strokes / stakes editable mid-setup; tabs switch in-game views |

**Not yet designed:** the **Settings** screen (Profile gear destination).

---

## 5. Stroke convention (Get / Give) — keep consistent everywhere

Always from **your** perspective, opponent-by-opponent:

- **Get** = you *receive* strokes from your opponent → **green** (`#1E6E16` text,
  `#EAF5EC` fill). A lower-handicap opponent (e.g. Marcus) → you Get.
- **Give** = you *spot* strokes to your opponent → **orange** (`#E0742E` /
  `#C75F1E`). A higher-handicap opponent (e.g. Dinesh, Jia Hui) → you Give.

This applies to the lobby Get/Give toggle, the lobby legend, the Profile friends
list ("you get 5 strokes" / "you give 9 strokes"), and the recap Carry-forward
strokes pills. Match-play results show the **stat only** ("3 UP" in the numeric
typeface) — never "you won / you lost".

---

## 6. Design-system reminder

Every screen pulls from the bound **Golf Kaki Design System**. Reuse its tokens
and components (`Button`, `ScoreBadge`, `Avatar`, etc.) — don't hand-roll colors
or type. One orange accent per view. Numbers in the numeric typeface.
