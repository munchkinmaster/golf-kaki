# CLAUDE.md — Golf Kaki

Repo-level instructions for Claude Code. Read this before doing any work.

## Project
**Golf Kaki** — a social golf scoring mobile app. *Track score · add fun.*
Friends ("kaki") start a round, pick a course + game mode, enter scores hole-by-hole,
watch a live leaderboard with money on the line, and get a shareable recap.

## Target stack
- **React Native + Expo** (mobile-first — every screen is designed at 360×760).
- If the repo already has a different stack set up, follow it; don't introduce a second one.
- TypeScript. Functional components + hooks.

## Where the design spec lives
All design references are in **`design/golf-kaki/`**:
- `README.md` — the full, self-sufficient spec. **Read it first.**
- `design-files/*.dc.html` — visual references. **READ-ONLY.** These are prototypes from
  another runtime; they do **not** run standalone and must **never** be imported, bundled,
  or compiled by the app. Read them as layout/copy specs only.
- `design-system/tokens/*.css` — **the source of truth for all design values.**
- `assets/*.svg` — brand mark + logo.

Primary screen flow is in `Golf Kaki Hi-Fi.dc.html`. `Golf Kaki Wireframes.dc.html` is
the same flow in lo-fi (structure only — hi-fi wins on styling).

## Hard rules
1. **Tokens, never magic values.** Translate `design/golf-kaki/design-system/tokens/*.css`
   into one theme module (`src/theme/tokens.ts`) and reference it everywhere. Do **not**
   hardcode hex colors, font sizes, radii, or shadows in components.
2. **Never ship the `.dc.html` files.** They're documentation. Keep `design/` out of the
   app build (it's reference material, not source).
3. **No emoji.** The brand expresses warmth through color, the crest, and word choice.
   Use Lucide icons (2px stroke, `currentColor`) for iconography.
4. **One accent per view.** Flag orange (`#FF914D`) marks the single most important
   action or the live indicator — never wallpaper with it. Primary actions are fairway
   green (`#134914`).
5. **Voice:** warm, casual, second person ("Your turn to tee off"). Sentence case
   everywhere except ALL-CAPS overlines with wide tracking. Use golf vocab correctly
   (gross, nett, to par, birdie, bogey, handicap, skins, fourball).

## Design fundamentals (quick reference — full table in the spec README)
- **Primary** green `#134914` · **Accent** orange `#FF914D` · **Page** parchment `#F7F2E6`
  · **Card** white · **Text** warm ink `#1C2B22` (never pure black).
- **Score colors:** eagle gold `#C98A23`, birdie orange `#E0742E`, par green `#1E6E16`,
  bogey slate `#4E6E8E`, double+ red `#B23B2E`.
- **Type:** Quicksand (display) · Plus Jakarta Sans (body) · Space Grotesk (numbers,
  tabular figures — use for ALL scores/stats/money).
- **Shape:** cards radius 16, buttons/badges/chips full pill, inputs radius 12.
- **Shadows:** warm green-tinted `rgba(14,58,40,…)`, never grey.
- **Tap targets ≥ 44px. 18px side gutters.**
- **Motion:** 200ms, ease-out `cubic-bezier(.22,1,.36,1)`; press → `scale(.985)`;
  focus → 4px green ring. No long/looping animation.

## Suggested build order
1. `src/theme/tokens.ts` from the token CSS. (Foundation — do first.)
2. Shared primitives: Button, ScoreBadge, HandicapBadge, Card, Avatar, TabBar, StatRow,
   LeaderboardRow.
3. Primary flow screens in `Golf Kaki Hi-Fi.dc.html` order (Landing → … → Recap).
4. Single scores store as source of truth; derive leaderboard + recap from it.
5. Supplementary features as needed: Trophy Cabinet, Brag Card / Ace Pin, Admin (course
   management — that one is a desktop/web surface, not the mobile app).

## Database migrations
- **Never hand-edit schema on a linked Supabase project** (no SQL editor / dashboard
  changes to tables, columns, or policies). Every schema change goes through a migration
  file + `supabase db push`. A hand edit silently desyncs the CLI's migration history from
  the actual database — the next `db push` then tries to re-run SQL that already happened
  and fails with duplicate-key/duplicate-table errors, exactly like
  `20260628120001_seed_tasik_puteri.sql` and others did once discovered.
- If a hand edit already happened (recovering from the above, or inherited from a prior
  session), don't just re-run the migration — verify what's actually live first (query the
  table/column/function directly), then either write the migration to match and
  `supabase migration repair --status applied <version>` it, or `supabase db pull` to
  generate the migration from live state.
- **Check before pushing.** Run `supabase migration list` (or `db push --dry-run`) to see
  local-vs-remote status before `db push` — don't push blind.

## Working agreement
- Small, reviewable PRs — one screen or one primitive at a time.
- When a design detail is ambiguous, check the `.dc.html` source (inline styles = the
  spec) before guessing; if still unclear, ask.
- Match the spec's exact copy where shown.
