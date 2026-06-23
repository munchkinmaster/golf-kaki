# Setup: Golf Kaki → GitHub → Claude Code

A step-by-step guide to get this handoff into a GitHub repo and start building with
Claude Code in VS Code.

---

## What you have
A folder `design_handoff_golf_kaki/` containing:
- `README.md` — the full design spec
- `CLAUDE.md` — repo instructions for Claude Code
- `design-files/` — HTML design references (read-only)
- `design-system/tokens/` — the design tokens (source of truth)
- `assets/` — brand SVGs
- `SETUP-GUIDE.md` — this file

---

## Part 1 — Get it into GitHub

### Option A · Brand-new repo (no app code yet)

1. **Create the repo on GitHub**
   - Go to github.com → **New repository** → name it e.g. `golf-kaki`.
   - Leave it empty (no README/gitignore — you'll add your own). Click **Create**.

2. **Put files in place locally.** Open a terminal where you want the project:
   ```bash
   mkdir golf-kaki && cd golf-kaki
   mkdir -p design
   # move the unzipped handoff into design/golf-kaki/
   mv /path/to/design_handoff_golf_kaki design/golf-kaki
   # promote the repo-level instructions to the root
   mv design/golf-kaki/CLAUDE.md ./CLAUDE.md
   ```
   Final layout:
   ```
   golf-kaki/
   ├── CLAUDE.md
   └── design/golf-kaki/   (README, design-files, design-system, assets)
   ```

3. **Add a .gitignore** (so the design refs stay docs, and future build junk is ignored):
   ```bash
   cat > .gitignore <<'EOF'
   node_modules/
   .expo/
   dist/
   *.log
   .DS_Store
   EOF
   ```

4. **Commit and push:**
   ```bash
   git init
   git add .
   git commit -m "Add Golf Kaki design handoff + CLAUDE.md"
   git branch -M main
   git remote add origin https://github.com/<your-username>/golf-kaki.git
   git push -u origin main
   ```

### Option B · You already have an app repo

1. `cd` into your existing repo.
2. Copy the handoff into a `design/` folder and move CLAUDE.md to root:
   ```bash
   mkdir -p design
   cp -R /path/to/design_handoff_golf_kaki design/golf-kaki
   mv design/golf-kaki/CLAUDE.md ./CLAUDE.md   # or merge into an existing CLAUDE.md
   ```
   > If you already have a `CLAUDE.md`, paste the Golf Kaki sections into it rather than
   > overwriting.
3. Commit on a branch and open a PR:
   ```bash
   git checkout -b add-golf-kaki-design
   git add .
   git commit -m "Add Golf Kaki design handoff + Claude instructions"
   git push -u origin add-golf-kaki-design
   ```

---

## Part 2 — Open it in Claude Code (VS Code)

1. **Clone/open the repo in VS Code**
   - If it's already local, just **File → Open Folder** on the repo root.
   - If it's on GitHub only: `git clone https://github.com/<you>/golf-kaki.git` then open it.

2. **Make sure Claude Code is installed**
   - Install the **Claude Code** extension from the VS Code Marketplace (or run
     `claude` in the integrated terminal if you use the CLI). Sign in when prompted.

3. **Open Claude Code at the repo root.** It auto-reads `CLAUDE.md`, so it picks up the
   stack, rules, and where the spec lives without you re-explaining.

4. **Kick it off.** A good first prompt:
   > Read `CLAUDE.md` and `design/golf-kaki/README.md`. Then set up an Expo + TypeScript
   > project and create `src/theme/tokens.ts` from `design/golf-kaki/design-system/tokens/`.
   > Don't build screens yet — just the theme. Show me the diff before committing.

5. **Then build incrementally.** Once tokens look right:
   > Now build the shared primitives (Button, ScoreBadge, HandicapBadge, Card, Avatar,
   > TabBar) using the theme. One component per commit.

   …then:
   > Implement the Landing and Home screens from `Golf Kaki Hi-Fi.dc.html`, in Expo,
   > using the primitives and theme. Match the spec's layout and copy.

---

## Part 3 — Working rhythm (keeps it scalable)

- **Branch per feature**, small PRs. Review Claude's diffs before merging.
- **Tokens are the contract.** If a color/size is wrong, fix it in `tokens.ts`, not in a
  component — everything inherits.
- **Design updates:** when you revise a design, drop the new `.dc.html`/tokens into
  `design/golf-kaki/`, commit, and ask Claude to re-implement the affected screen against
  it. The handoff stays a living spec.
- **Keep `design/` out of the build.** It's reference material; never import the
  `.dc.html` files into the app.
- Point Claude at a specific screen + the spec each session so it has tight context,
  rather than "build the whole app" in one go.

---

## Quick reference — first prompts to paste
```
1. Read CLAUDE.md and design/golf-kaki/README.md. Scaffold an Expo + TS app and build
   src/theme/tokens.ts from design/golf-kaki/design-system/tokens/. Theme only.

2. Build shared primitives (Button, ScoreBadge, HandicapBadge, Card, Avatar, TabBar,
   StatRow, LeaderboardRow) from the theme. One commit each.

3. Implement screens from Golf Kaki Hi-Fi.dc.html in flow order, starting with Landing
   and Home. Match layout + copy. Derive leaderboard/recap from one scores store.
```
