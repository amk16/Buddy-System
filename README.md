# AI Marketing Pulse

A **private** intelligence feed for an AI consultant. On each run, a small Python
pipeline curates AI-for-business **tools / news / people** into a dated "issue,"
written as JSON. A React dashboard renders the latest issue (with a 30-second
**Brief** up top) plus an archive of past issues.

Scope: AI across business functions (ops, finance, sales, support, marketing),
tilted toward cost-saving / automation / ROI signal. Each card is a **plain-language
brief** — a 2–4 sentence summary (who/what/where/when/how), a one-line "why it
matters," and a short glossary explaining any jargon — written for a smart
non-technical reader. The engine reads each chosen article to ground the summary;
nothing is invented.

```
config.yaml → collectors (RSS + grounded web_search) → curator (Claude API)
            → enrich (stub) → issues/*.json → React dashboard
```

## Layout

```
backend/                  Python pipeline (data)
  config.yaml             ← the ONLY file you edit to tune the feed
  pipeline.py             entrypoint
  config.py               loads config.yaml
  collectors/rss.py       RSS feeds → candidate items
  collectors/web.py       Claude web_search → grounded trending items (real URLs)
  curator.py              Claude API: dedupe / classify / score / summarize → issue
  enrich.py               PASS-THROUGH stub (future ROI / case-study layer)
  notify.py               NO-OP stub (future "new issue is up" ping)
  store.py                writes issues + index.json; tracks seen URLs for dedup
frontend/                 React + Vite + TS dashboard (presentation)
  public/issues/          generated JSON lands here → bundled on build
  src/                    App.tsx, components/, lib/types.ts (the contract)
```

## Run it

**1. Backend deps** (once):

```bash
pip install -r backend/requirements.txt
```

**2. Generate an issue.** Two engines:

**A) Claude Code engine — default, no API cost.** Python collects (free); a Claude
Code session does the web-grounded trending + curation.

**One step:** in a Claude Code session, run the slash command:

```
/pulse
```

It does the whole flow end-to-end (collect → web-search trending → curate → validate →
persist) following the guardrails in `CLAUDE.md`. (Command lives at
`~/.claude/commands/pulse.md`.)

Or run the three steps manually:

```bash
python backend/pipeline.py --collect          # RSS -> backend/pool.json
# Claude Code reads pool.json, web-searches trending, writes backend/curated.json
python backend/pipeline.py --write backend/curated.json   # validate + persist
```

**B) Anthropic API engine — optional, fully autonomous (~cents/issue).** Paste a key
into `backend/.env` (auto-loads, no `export`; gitignored), then run with no args:

```
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...
```
```bash
python backend/pipeline.py
```

No key and just want to see the dashboard? Write demo data:

```bash
python backend/pipeline.py --sample
```

**3. View the dashboard:**

```bash
cd frontend
npm install        # once
npm run dev        # open the printed localhost URL
# or: npm run build && npm run preview
```

Generating a new issue + refreshing the page shows it. The latest issue is the
default view; use the issue switcher (top right) to read past issues.

## Tuning

Everything lives in `backend/config.yaml`: cadence label, `relevance_focus`
(the curation lens), `lookback_days`, per-section `max_items`, `brief_count`,
RSS feed list, and web-search queries. Adding a feed is one line. Bad/unreachable
feeds are skipped automatically.

## Curation guardrails

The curator may only rank/summarize items from the fetched pool — every output
item must carry a real URL from the input; it never adds tools, people, or quotes
from model memory. Trending items come from Claude's `web_search` tool (real
citations). `store.py` excludes URLs from prior issues so nothing repeats.

## Automating later (private)

This is a private, local-first tool — no public hosting. To run it on a cadence
on your own machine, wrap the two commands in a local scheduler:

- **macOS launchd / cron** — run `python backend/pipeline.py` on a schedule, then
  `npm run build` so the dashboard reflects the new issue.
- The `notify.py` stub is where a "new issue is up + top 3" ping (email/WhatsApp)
  would be wired so you don't have to remember to open the dashboard.

## Out of scope (v1)

ROI / case-study / use-case enrichment (seated at `enrich.py`, built later),
notification delivery (seam only), self-serve settings UI, and any public/branded
deployment.
