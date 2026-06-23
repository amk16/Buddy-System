# Changelog

Every notable change to **AI Marketing Pulse** — the engine that curates issues, the
dashboard that renders them, and the source network they're drawn from.

## How this file works

- **Newest release on top.** Each release has a `version`, a `date`, and a one-line
  *theme* — the headline change in plain language.
- Changes are grouped by **pillar**, so you can scan for the part you care about:
  - 🧠 **Engine** — the curation pipeline (`backend/`): collection, validation, the rules.
  - 🎨 **Dashboard** — the React reading experience (`frontend/`): layout, design, motion.
  - 📡 **Sources** — the feed network and what gets curated (`config.yaml`, sections).
  - 🧰 **Tooling** — skills, slash commands, deploy/config plumbing.
- Within a pillar, tag each line **Added / Changed / Fixed / Removed**.
- **Versioning** (loose semver, product-flavored):
  - **MAJOR** — a new way of reading or generating an issue (e.g. a new front door).
  - **MINOR** — a new section, feed tier, mascot behavior, or design layer.
  - **PATCH** — copy, contrast, dedup, and review-round polish.
- **Issues are content, not releases.** New dated issues (`frontend/public/issues/*.json`)
  ship continuously and aren't tracked here unless they change the *format* of an issue.

### Template for the next entry

```md
## [vX.Y.Z] — YYYY-MM-DD — <one-line theme>

🧠 Engine
- Added/Changed/Fixed: …

🎨 Dashboard
- Added/Changed/Fixed: …

📡 Sources
- Added/Changed/Fixed: …

🧰 Tooling
- Added/Changed/Fixed: …
```

---

## [v1.0.0] — 2026-06-23 — A private AI-for-business pulse, read like a newspaper

The first complete version: a free Claude Code curation engine, a tiered source
network with grounded summaries, and a warm "Buddy-System" dashboard wearing the
Scribbld **Highlighter & Ink** brand, with the RoboBuddy mascot throughout.

🧠 Engine
- Added: **Claude Code curation engine** — the default, no-API-cost path. Python
  collects RSS candidates for free; a Claude Code session does the web-grounded
  trending + editorial judgment (`/pulse`).
- Added: **Anthropic API engine** as an optional fully-autonomous fallback
  (`curator.py`, ~cents/issue).
- Added: **grounded collection** — RSS collectors plus a `web_search` pass that only
  keeps results with a real, in-window URL; every output item carries a real source.
- Added: **validation + persistence** (`pipeline.py --write`) — re-enforces the rules,
  dedupes near-identical stories, drops `seen_urls`, caps per-section counts, writes the
  dated issue, and rebuilds the index.
- Added: **brief auto-fill by URL** — the Brief lists items by URL and the pipeline
  copies the full card from its section automatically.
- Added: **empty-summary gate** — items without a grounded summary are rejected, so
  nothing ships unexplained.
- Added: `enrich.py` (pass-through seam for a future ROI/case-study layer) and
  `notify.py` (no-op seam for a future "new issue is up" ping).

📡 Sources
- Added: **tiered 16-feed source network** — a ranked, multi-tier RSS roster tuned for
  AI-for-business signal (ops, finance, sales, support, marketing).
- Added: **`case_studies` section** — named company + what they deployed + a measurable
  result. A story with no measurable result is News, not a Case Study.
- Added: **ranked curation priorities** — client-ready talking points first, then the
  reader's learning curve, then market radar. A weaker story she can *use* beats a
  bigger one she can't.
- Added: **card shapes** per section (Brief / case_studies / people) and
  **action-phrased `why_it_matters`** — one sentence she can act on, no clickbait.

🎨 Dashboard
- Added: **React 19 + Vite + TypeScript** dashboard rendering the latest issue with a
  30-second **Brief** up top and an **archive switcher** for past issues.
- Added: **warm-paper redesign** — light tokens, disclosure cards, reading-time chip.
- Added: **self-hosted variable fonts** — Fraunces (display) + Source Sans 3 (text).
- Added: **Buddy-System design language** — a bento "glance" front door, fill-screen
  takeover morph into the issue, view transitions, and an ambient **RoboBuddy** mascot
  (corner, dialogue box, and peeping hover states). Codified view states, motion tokens,
  and mascot rules.
- Added: **Highlighter & Ink** — the Scribbld brand accent layer (gold ink, marker-yellow
  decoration, butter-toned Brief surface) and an RPG dialogue-box masthead with a
  centered RoboBuddy portrait.

🧰 Tooling
- Added: **`/pulse`** slash command — runs the whole flow end-to-end behind `CLAUDE.md`
  guardrails.
- Added: **`pulse-design`** and **`pulse-design-review`** project skills to keep
  dashboard changes on-brand and reviewed.
- Added: **Vercel config** for the frontend Vite app.

[v1.0.0]: https://github.com/
