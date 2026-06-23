# AI Marketing Pulse

> A **private** intelligence feed for an AI consultant — the AI-for-business world,
> curated daily into a dated "issue" and read like a small, beautiful newspaper.

Each run, a Python pipeline gathers candidate stories; a Claude Code session reads the
real articles and writes plain-language briefs; the result is a dated JSON **issue**. A
React dashboard renders the latest issue — a 30-second **Brief** up top, sections below,
and an archive of everything before it.

**Scope:** AI across business functions (ops, finance, sales, support, marketing),
tilted toward cost-saving / automation / ROI signal.

**The reader:** a sharp marketer moving into AI consulting — not a technical expert, but
learning fast. So every card stands on its own: a 2–4 sentence summary (who / what /
where / when / how), a one-line **why it matters** she can act on, and a short glossary
for any jargon. The engine reads each chosen article to ground the summary — **nothing
is invented.**

```
config.yaml → collect (RSS + grounded web_search) → curate (read & write briefs)
            → validate & dedupe → issues/*.json → React dashboard
```

---

## How an issue is made

There are two engines. The **Claude Code engine is the default** — it costs nothing per
issue, because Claude Code (not a paid API call) does the trending + editorial work.

**A) Claude Code engine — default, no API cost.** In a Claude Code session:

```
/pulse
```

That's it — it runs the whole flow (collect → web-search trending → read & curate →
validate → persist) behind the guardrails in `CLAUDE.md`. To run the steps by hand:

```bash
python backend/pipeline.py --collect                    # RSS → backend/pool.json
# Claude Code reads pool.json, web-searches, writes backend/curated.json
python backend/pipeline.py --write backend/curated.json # validate + persist the issue
```

**B) Anthropic API engine — optional, fully autonomous (~cents/issue).** Drop a key in
`backend/.env` (auto-loads, gitignored) and run with no args:

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' > backend/.env
python backend/pipeline.py
```

**Just want to see the dashboard?** Write demo data: `python backend/pipeline.py --sample`.

### Publish it to the live site

The dashboard deploys on Vercel from the `main` branch, so a new issue goes live only
after its files are pushed. Once `/pulse` (or `--write`) has written the dated issue,
ship it in one step:

```bash
./publish.sh        # commits frontend/public/issues/* and pushes → Vercel redeploys
```

It no-ops if there's nothing new, and only runs on the deploy branch (`main`).

---

## Reading it

```bash
cd frontend
npm install      # once
npm run dev      # open the printed localhost URL
```

The dashboard opens on the **glance** — a bento front door — then morphs into the latest
issue. The **Brief** is the 30-second read; sections expand below; the archive switcher
(top right) opens past issues. **RoboBuddy**, the resident mascot, hangs around to keep it
warm. The look is the Scribbld **Highlighter & Ink** brand — gold ink, marker-yellow
accents, warm paper — codified in the **Buddy-System** design language.

---

## The map

```
backend/                  Python pipeline — the engine
  config.yaml             ← the ONLY file you edit to tune the feed
  pipeline.py             entrypoint (--collect / --write / --sample / no-args)
  collectors/rss.py       RSS feeds → candidate items
  collectors/web.py       grounded web_search → trending items (real URLs only)
  curator.py              optional Anthropic API path: dedupe / classify / summarize
  validate.py             the rules — enforced on every --write
  store.py                writes issues + index.json; tracks seen URLs for dedup
  enrich.py               pass-through seam (future ROI / case-study layer)
  notify.py               no-op seam (future "new issue is up" ping)
frontend/                 React 19 + Vite + TypeScript — the dashboard
  public/issues/          generated issue JSON → bundled on build
  src/components/         Glance, Brief, Section, ItemCard, Archive, RoboBuddy (Buddy*)
  src/lib/types.ts        the issue contract shared with the backend
```

## Tuning

Everything lives in **`backend/config.yaml`**: cadence label, `relevance_focus` (the
curation lens), `lookback_days`, per-section `max_items`, `brief_count`, the tiered RSS
roster, and the web-search queries. Adding a feed is one line; unreachable feeds are
skipped automatically.

## Guardrails (why this stays credible)

This feed exists to make her credible with clients, so the rules are strict:

- **Only real URLs** — from the RSS pool or a real web result actually retrieved. Never
  invent tools, people, quotes, or links.
- **Grounded summaries** — summary and glossary come from the source, never from memory.
- **No repeats** — `store.py` excludes URLs from prior issues and dedupes near-identical
  stories.
- **Per-section caps + ranked priorities** — quality over quantity; fewer than the max is
  fine when the pool is thin.

## Out of scope (v1)

ROI / case-study / use-case enrichment (seated at `enrich.py`, built later),
notification delivery (seam only), a self-serve settings UI, and any public deployment.
It's a private, local-first tool.

---

📓 See [`CHANGELOG.md`](./CHANGELOG.md) for what shipped in **v1** and the format for
future updates. 🤖 Engine rules and curation contract live in [`CLAUDE.md`](./CLAUDE.md).
