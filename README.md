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

There are three engines. The **Claude Code engine is the default** — it costs nothing per
issue, because Claude Code (not a paid API call) does the trending + editorial work. The
**Gemini engine** is the hands-off one: it runs on a schedule and publishes on its own.

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

**C) Gemini engine — autonomous stream (~cents/issue).** The no-human-in-the-loop path.
It uses grounded Google Search to find trending items and `gemini-3.1-pro-preview` (set in
`config.yaml`) to curate them, with the same real-URL and grounding guarantees. Run it
locally with a key in `backend/.env`:

```bash
echo 'GEMINI_API_KEY=...' >> backend/.env   # key from https://aistudio.google.com/apikey
python backend/pipeline.py --gemini
```

…but its real home is the scheduled **GitHub Action** (`.github/workflows/pulse.yml`): it
generates an issue and pushes to `main`, so Vercel rebuilds and the issue goes live with no
one touching it. **Setup:** add your key as the repo secret `GEMINI_API_KEY` (Settings →
Secrets → Actions). **Cadence:** edit the single `cron:` line in the workflow. **On demand:**
Actions tab → *Publish AI Marketing Pulse* → *Run workflow* (Kajol can fire one any time;
multiple a day is fine). A `min_items_to_publish` floor in `config.yaml` makes a thin run
abort rather than publish a threadbare issue.

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

## Reader feedback loop

When Kajol reacts to a card or to a whole issue in the dashboard, that reaction is sent
to a Vercel function which appends it to `feedback/YYYY-MM.jsonl` on the git branch
`feedback` (never `main`; that branch never deploys, because `git.deploymentEnabled.feedback`
is `false` in `vercel.json`). Each pipeline run turns the accumulated reactions into a
reader profile and a proposed **steer** (a short instruction for the curator), which only
takes effect once Ali reviews and accepts it.

**One-time setup (Ali):**

1. On GitHub, create a fine-grained personal access token scoped to `amk16/Buddy-System`
   with **Contents: read and write**, expiry at most one year.
   Token renewal due: <date>
2. In Vercel, add these env vars for both **Production** and **Preview**:
   `GITHUB_TOKEN`, `GITHUB_REPO=amk16/Buddy-System`, `FEEDBACK_BRANCH=feedback`,
   `FEEDBACK_ALLOWED_ORIGINS=https://buddy-system-ivory.vercel.app` (leaving this last one
   unset means every request is refused with a 403).
3. After the `vercel.json` files (repo root and `frontend/`) are on `main`, create the
   branch once:
   ```bash
   git branch feedback main && git push origin feedback
   ```
   Then confirm in Vercel that the push created no deployment.
4. **First-deploy checks** against the production URL: `GET /api/feedback` answers 405
   with an `Allow: POST` header, `OPTIONS /api/feedback` answers 204, and
   `GET /api/_lib/github` answers 404 (proves `_lib` is not deployed).

Preview deployments are not in `FEEDBACK_ALLOWED_ORIGINS`, so a preview site's posts are
refused with a 403 and one console warning; that is expected, not a bug. This project also
has Vercel deployment protection on, so curl checks against a *preview* URL need a
logged-in browser or a protection-bypass token - the production URL is public.

**Reading the profile:**

```bash
git fetch origin feedback
python backend/pipeline.py --profile   # flags: --feedback-dir, --proposal, --proposer
```

Then open `profile/report.html` locally — it is generated by the run but never served
by Vercel. The GitHub Action also regenerates `profile/` on every published issue.

**Accepting a steer:**

```bash
git pull                                  # first: see below
python backend/pipeline.py --accept-steer
```

Pull first. Every Action publish that clears the explicit-reaction floor rewrites
`profile/proposal.yaml` and pushes it, so a proposal you stamped locally will conflict
with the pushed one unless you started from it.

This copies `profile/proposal.yaml` into `backend/steer.yaml`, which is committed and
read by every engine (the READER PROFILE block in the curation prompt; `reader_profile`
in `pool.json` for the Claude Code engine). This changes what the curator is told, so
review the proposal first.

**Tuning:** the `feedback:` block in `backend/config.yaml` (`half_life_days`,
`min_explicit_for_proposal`, `top_k`).

Two signals are recorded silently: a card's Details opened, and a headline clicked.
The visible control is the **reaction mark** on every section card — one pixel heart
with three states, where a tap climbs none → like → super like (the heart fills with
green, then glows gold a size larger) and a press and hold takes it back down, plus
reason chips inside Details once a card has been marked
(`docs/superpowers/specs/2026-09-22-reaction-marks-design.md`). The issue-level check-in
is still a separate, upcoming design.

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
  pipeline.py             entrypoint (--collect / --write / --gemini / --sample / --profile / --accept-steer / no-args)
  collectors/rss.py       RSS feeds → candidate items
  collectors/web.py       Anthropic grounded web_search → trending items (real URLs only)
  collectors/web_gemini.py Gemini Google-Search grounding → trending items (real URLs only)
  curate_schema.py        shared output schema + system prompt (both autonomous engines)
  curator.py              Anthropic API path: dedupe / classify / summarize
  gemini_curator.py       Gemini API path: the autonomous-stream curator
  url_resolve.py          resolve Google grounding redirects; canonicalize URLs
  reader_profile.py       reader-feedback loop: reactions → profile → proposed steer
  steer.yaml              the active steer (committed; written by --accept-steer)
  validate.py             the rules — enforced on every --write
  store.py                writes issues + index.json; tracks seen URLs for dedup
  enrich.py               pass-through seam (future ROI / case-study layer)
  notify.py               no-op seam (future "new issue is up" ping)
.github/workflows/pulse.yml  scheduled + on-demand autonomous publish (Gemini → main → Vercel)
frontend/                 React 19 + Vite + TypeScript — the dashboard
  public/issues/          generated issue JSON → bundled on build
  src/components/         Glance, Brief, Section, ItemCard, Archive, RoboBuddy (Buddy*)
  src/lib/types.ts        the issue contract shared with the backend
  src/lib/feedback.ts     reaction/click events → queued, batched POST to api/feedback
  api/feedback.ts         Vercel Function: validates events, appends to the feedback branch
  vitest                  frontend test runner (`npm test` in frontend/)
profile/                  generated reader profile + local HTML report (never served)
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
It's a private, local-first tool. (The reader feedback loop above is in scope and
shipped, the reaction mark and all; only the issue-level check-in is still to come.)

---

📓 See [`CHANGELOG.md`](./CHANGELOG.md) for what shipped in **v1** and the format for
future updates. 🤖 Engine rules and curation contract live in [`CLAUDE.md`](./CLAUDE.md).
