# Handoff: Golf Kaki — Mobile Scoring App

> **Track score · Add fun.** A golf scoring app that turns score-keeping into the best
> part of the weekend round. *Kaki* = Malay/Singaporean slang for a regular buddy.

## Overview
This bundle is the design handoff for the **Golf Kaki** mobile app — a social golf
scoring product. A group of friends ("kaki") starts a round, picks a course and game
mode (skins, stroke play, etc.), adds players with handicaps, plays the round entering
scores hole-by-hole, watches a live leaderboard with money on the line, and gets a
shareable recap at the end. Supplementary surfaces cover an admin tool for adding
courses, a trophy/achievement system, and shareable "brag card" / "ace pin" rewards.

## About the design files
The files in `design-files/` are **design references created in HTML** — interactive
prototypes that show the intended look, layout, copy, and behavior. **They are not
production code to copy directly.** Each is a "Design Component" (`.dc.html`) authored
in a custom prototyping runtime; they will not run standalone outside that runtime, so
treat them as **visual + structural specifications you read**, not modules you import.

Your task: **recreate these designs in the target codebase** using its existing
framework and patterns (React Native / Expo, Flutter, SwiftUI, etc.). If no app
codebase exists yet, choose the most appropriate stack for a mobile-first social app
and implement there. **React Native (Expo) is the natural fit** given the all-mobile
screens, but any modern mobile stack works.

The single most useful reference is `design-system/` — the real, exact design tokens
(colors, type, spacing, radius, shadow, motion). Wire these into your app's theme
first; everything else follows from them.

## Fidelity
**Mixed — two levels are included:**

- **`Golf Kaki Hi-Fi.dc.html` — HIGH FIDELITY.** Final colors, typography, spacing,
  shadows, and interactions. Recreate these screens pixel-faithfully using the tokens.
  **This is the primary spec.**
- **`Golf Kaki Wireframes.dc.html` — LOW FIDELITY.** The same 11-screen flow as
  greyscale wireframes. Use only to understand structure/flow; the hi-fi file supersedes
  it for all styling. (Included for context on layout intent.)
- The three supplementary files (Admin, Trophy Cabinet, Brag Card & Ace Pin) are
  **high fidelity** feature explorations — build them as the matching features come up.

All screens are designed at a **360 × 760px** mobile frame (phone bezel in the mock is
decoration — ignore it; the app content area is what you build).

---

## Design tokens (source of truth)
These are copied verbatim into `design-system/tokens/`. Load them into your theme.

### Color
| Token | Hex | Role |
|---|---|---|
| `--green-800` | `#134914` | **Primary** — fairway green. Hero cards, primary buttons, brand text |
| `--green-900` | `#0E3A10` | Primary hover |
| `--green-950` | `#0A2C0C` | Primary active |
| `--green-100` | `#DFEEDC` | Soft green fill (avatars, selected) |
| `--green-50` | `#F0F6EE` | Brand-soft surface |
| `--orange-500` | `#FF914D` | **Accent** — flag orange. ONE per view: the single most important action / live indicator |
| `--orange-600` | `#E0742E` | Accent hover / birdie |
| `--orange-100` | `#FFEEE0` | Accent-soft surface |
| `--sand-100` | `#F7F2E6` | **Default page background** (parchment) |
| `--sand-50` | `#FCFAF3` | Raised cream surface |
| `--white` | `#FFFFFF` | Card surface |
| `--sand-200` | `#EFE8D5` | Subtle border / sunken surface |
| `--sand-300` | `#E3D9C0` | Default border |
| `--ink-900` | `#1C2B22` | Primary text (warm, green-tinted — never pure black) |
| `--ink-700` | `#3A4A40` | Secondary text |
| `--ink-500` | `#5E6B62` | Muted text / overlines |

**Score notation colors** (drive the score badges):
| Term | Token | Hex |
|---|---|---|
| Eagle (−2 or better) | `--score-eagle` | `#C98A23` (gold) |
| Birdie (−1) | `--score-birdie` | `#E0742E` (orange) |
| Par (even) | `--score-par` | `#1E6E16` (green) |
| Bogey (+1) | `--score-bogey` | `#4E6E8E` (slate blue) |
| Double+ (+2 or worse) | `--score-double` | `#B23B2E` (red) |

### Typography
| Role | Family | Usage |
|---|---|---|
| Display | **Quicksand** (400–700) | Headings, big moments, brand wordmark |
| Body | **Plus Jakarta Sans** | All UI / reading text |
| Numeric | **Space Grotesk** (tabular figures) | Scores, handicaps, stats, money — anything numeric |

Scale (1rem = 16px): `2xs` 11px · `xs` 12px · `sm` 14px · `md` 16px · `lg` 18px ·
`xl` 22px · `2xl` 28px · `3xl` 36px · `4xl` 48px · `5xl` 64px (hero score).
Line heights: tight 1.1, snug 1.25, normal 1.5. Tracking: wide `.04em`,
wider `.12em` (overlines/tagline, ALL-CAPS).

Casing: **sentence case** everywhere except the ALL-CAPS overline/tagline (always with
wide letter-spacing). **No emoji** anywhere — the brand uses color, the crest, and word
choice instead. Icons are **Lucide** line icons at 2px stroke, inheriting `currentColor`.

### Spacing, radius, shadow, motion
- **Spacing:** 4px base grid. Mobile side gutters **18px**. Tap targets **≥ 44px**.
- **Radius:** cards `--radius-lg` 16px · buttons/badges/chips/tabs full pill
  `--radius-pill` 999px · inputs `--radius-md` 12px · xs 4 / sm 8 / xl 24 / 2xl 32.
- **Shadow:** warm green-tinted, never grey. `xs` `0 1px 2px rgba(14,58,40,.06)` →
  `xl` `0 24px 56px rgba(14,58,40,.18)`. Accent CTA glow: `0 8px 20px rgba(255,145,77,.35)`.
- **Borders:** hairline sand. 1.5px standard control border. Green border for emphasis/focus.
- **Motion:** quick + tactile. `--dur-base` 200ms, `--ease-out`
  `cubic-bezier(.22,1,.36,1)`. Buttons depress slightly on press (`scale(.985)`).
  Switch thumb uses bounce overshoot `cubic-bezier(.34,1.56,.64,1)`. Focus = 4px soft
  green ring `rgba(26,126,72,.35)`. No long/looping decorative animation.
- **Texture:** flat parchment default. The emblem mark
  (`assets/golf-kaki-mark.svg`) is used as a large, very low-opacity (~5–10%) watermark
  on green hero cards (`filter: brightness(0) invert(1)` to render it white on green).

---

## Screens — `Golf Kaki Hi-Fi.dc.html` (primary flow, 11 screens)

Flow order: **Landing → Home → Profile → Select course → Select starting hole →
Create game → Game mode info → Match lobby → In-game scorecard → Leaderboard
(+ expanded row) → Finish → Past-game recap.**

1. **Landing** — Full-bleed green (`#134914`) splash. Centered orange flag icon in a
   frosted rounded-square tile, ALL-CAPS tagline, big Quicksand headline ("Golf with
   your kaki."), subhead, and a primary CTA. Radial green glow top, faint emblem
   watermark, decorative thin circles. Status bar in white.
2. **Home** — Parchment page. Greeting ("Morning, Marcus"), accent **Start round** CTA
   (the one orange action), a green hero card showing handicap index with emblem
   watermark, recent rounds list, bottom tab bar (Home / Leaderboard / Profile).
3. **Profile** — Avatar (emblem on soft-green disc), name + handicap, stat row, list of
   stats/achievements, settings rows.
4. **Select course** — Search field, list of course cards (name, location, par, tee
   info), each tappable. An overline section label.
5. **Select starting hole** — Bottom-sheet over a dimmed course screen; choose Hole 1
   or a shotgun start hole.
6. **Create game** — Green info card (emblem watermark), game-mode selector (Skins /
   Stroke / Stableford…), stakes input ("Loser buys teh tarik"), player rows with
   handicap badges, add-player control.
7. **Game mode info** — Modal/sheet explaining the selected mode's rules.
8. **Match lobby** — "Players · 3 of 4" header, player cards with avatars + handicaps +
   ready state, accent **Start** CTA, share-to-invite affordance.
9. **In-game scorecard** — Horizontally-scrollable hole-by-hole grid (holes as columns,
   players as rows), score badges using the notation colors, par row, running
   front/back-nine + total. Live "thru" indicator (pulsing orange dot).
10. **Leaderboard (in-game)** — Ranked rows: position, player, to-par (color-coded),
    money (`+$` / `-$`). A swords/versus header. **Row expanded** variant reveals
    hole-by-hole detail for that player.
11. **Finish → Recap** — "Confirm scores" review, then a celebratory past-game recap:
    winner banner (orange), final standings, money settled, shareable card entry point.

Exact copy, paddings, and colors are in the file — open it in this project's preview to
read measurements directly, or read the HTML source (inline styles = the spec).

## Supplementary surfaces
- **`Golf Kaki Admin - Add Course.dc.html`** *(hi-fi, desktop/web)* — Internal tool to
  add a golf course: two-column form (course details + hole-by-hole par/distance) with
  a live summary panel. Green top bar. Build only if you need course-management tooling.
- **`Golf Kaki Trophy Cabinet.dc.html`** *(hi-fi)* — Achievement system: a 3-tier badge
  scheme (tier legend + badge states), a profile "trophy cabinet" grid, and a full-screen
  "unlock moment" celebration (gold radial glow on green).
- **`Golf Kaki Brag Card & Ace Pin.dc.html`** *(hi-fi)* — Shareable end-of-round brag
  card (420px social-share format), an "ace pin" reward (anatomy + tiers), pins shown in
  the lobby and on the leaderboard.

---

## Interactions & behavior
- **Navigation:** stack-based mobile flow following the order above; bottom tab bar
  (Home / Leaderboard / Profile) on top-level screens. Modals/bottom-sheets for
  starting-hole pick and game-mode info.
- **Score entry:** tap a hole cell → increment/stepper; the badge recolors by golf term
  as strokes vs par change (use the score-color table). Front/back/total recompute live.
- **Live leaderboard:** recomputes to-par and money on every score change; pulsing orange
  dot marks the live hole/"thru".
- **Press states:** solids darken on hover, shrink to `scale(.985)` on press; ghost
  buttons get a soft brand-tint background. Focus = 4px green ring.
- **Switches:** thumb animates with bounce overshoot.
- **No long/looping animation** beyond the live-dot pulse and the unlock celebration.

## State management
Core domain state the app needs:
- **Round:** course, tee, starting hole, game mode, stakes, list of players (with
  handicap index), status (lobby / live / finished).
- **Scores:** per-player per-hole strokes; derived gross, nett, to-par, front/back/total.
- **Leaderboard:** derived standings + money/skins settlement from scores + mode rules.
- **Profile:** name, handicap index, history of past rounds, achievements/pins/trophies.
- **Admin (separate):** course catalog (name, location, par, hole pars/distances).

Most screens are pure functions of round + scores; keep score entry as the single
source of truth and derive leaderboard/recap from it.

## Assets
- `assets/golf-kaki-mark.svg` — emblem crest. Avatars, watermarks (low opacity), app
  icon, splash. White-on-green via `filter: brightness(0) invert(1)`.
- `assets/golf-kaki-logo-transparent.svg` — full logo (crest + wordmark + tagline) for
  light surfaces.
- **Icons:** [Lucide](https://lucide.dev) at 2px stroke. Set used: `flag`, `trophy`,
  `target`, `users`, `map-pin`, `calendar`, `clock`, `circle-dot`, `plus`, `minus`,
  `chevron-left/right`, `share-2`, `house`, `user`, `swords`.
- **Fonts:** Quicksand, Plus Jakarta Sans, Space Grotesk (Google Fonts).

## Files in this bundle
```
design_handoff_golf_kaki/
├── README.md                     ← this file (self-sufficient spec)
├── design-files/                 ← HTML design references (read, don't ship)
│   ├── Golf Kaki Hi-Fi.dc.html              (PRIMARY — hi-fi flow, 11 screens)
│   ├── Golf Kaki Wireframes.dc.html         (lo-fi structure of same flow)
│   ├── Golf Kaki Admin - Add Course.dc.html (hi-fi, desktop admin)
│   ├── Golf Kaki Trophy Cabinet.dc.html     (hi-fi, achievements)
│   └── Golf Kaki Brag Card & Ace Pin.dc.html(hi-fi, share/rewards)
├── design-system/                ← THE design tokens (wire into your theme first)
│   ├── styles.css
│   └── tokens/  (colors · typography · spacing · radius · fonts · base .css)
└── assets/                       ← brand SVGs
    ├── golf-kaki-mark.svg
    └── golf-kaki-logo-transparent.svg
```

## Suggested first steps in Claude Code
1. Read this README end-to-end.
2. Translate `design-system/tokens/*.css` into your app's theme (a `theme.ts` / design
   tokens module). This is the foundation — do it first.
3. Build the shared primitives the screens reuse: Button (green/accent pill),
   ScoreBadge (notation circle/square, color by term), HandicapBadge, Card, Avatar,
   Tab bar, StatRow, LeaderboardRow.
4. Implement the primary flow screens in `Golf Kaki Hi-Fi.dc.html` order, deriving
   leaderboard/recap from a single scores store.
5. Layer in the supplementary features (achievements, brag card, admin) as needed.
