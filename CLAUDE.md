# AI Marketing Pulse — Claude Code engine instructions

This is a **private intelligence feed** for **Kajol Bheda** (Scribbld CEO moving into
general **AI consulting**). It curates AI-for-business **tools / news / people** into a
dated issue, rendered by a React dashboard. Scope: AI across business functions
(ops, finance, sales, support, marketing), tilted toward cost-saving / automation / ROI
signal that helps her advise clients and spot case-study angles.

**You (Claude Code) are the curation engine** — this avoids per-issue API cost. The
deterministic collection runs in Python; you do the web-grounded trending + the
editorial judgment.

## How to generate an issue

1. **Collect (free):**
   ```bash
   python backend/pipeline.py --collect
   ```
   Writes `backend/pool.json` = `{ relevance_focus, lookback_days, brief_count,
   sections:[{id,label,max_items}], web_search_queries, valid_signal_tags,
   seen_urls, pool:[RSS candidates] }`.

2. **Read `backend/pool.json`.**

3. **Get trending items:** run `WebSearch` on each `web_search_queries` entry (and
   `WebFetch` to confirm/extract specifics where useful). Keep only results with a
   **real URL** published within `lookback_days`. These augment the RSS `pool`.

4. **Select** the top items per section (obey the HARD RULES), then **deep-read each selected
   item**: `WebFetch` its URL and write a grounded, plain-language `summary` + `terms` from the
   real article. If a page is blocked/paywalled (e.g. 403), fall back to the RSS blurb / search
   snippet and write a shorter summary — never fabricate specifics (numbers, dates, names).

5. **Write the body** to `backend/curated.json`:
   ```json
   {
     "brief": [ <item>, ... ],
     "sections": [ { "id": "tools", "label": "🛠 Tools", "items": [ <item> ] }, ... ]
   }
   ```
   `<item>` = `{ section, headline, summary, why_it_matters, terms, url, source_name, signal_tag, published_at }`
   where `terms` = `[{ "term", "definition" }]` (use `[]` when nothing needs defining).

   **THE READER** is a sharp marketer moving into AI consulting — NOT a technical expert, but
   learning. Write so she understands each card without opening the source:
   - `summary`: 2–4 plain sentences making WHO / WHAT / WHERE / WHEN / HOW clear *naturally* (do
     not label them). Gloss unavoidable jargon in-line, e.g. `its AI "shopping assistant" (a
     chatbot that helps shoppers buy)`.
   - `terms`: define any genuinely technical term on the card in one plain sentence; `[]` if none.
     No acronym left unexplained; no circular definitions.
   - `why_it_matters`: ONE sentence phrased as an action she can take — "pitch X
     to retail clients", "try Y on a client workflow", "flag Z before any agent
     deployment". No clickbait.

   **Ranked priorities** when choosing between candidates: (1) client-ready
   talking points she can repeat today; (2) her own learning curve; (3) market
   radar. A weaker story she can USE beats a bigger story she can't.

   **Card shapes (per section):**
   - Brief cards: sentence ONE of the summary must contain a concrete fact or
     number from the source (a %, $, count, or date).
   - `case_studies`: a named company + what they deployed + the measurable
     result (%, $, hours saved) in sentence one. A story with no measurable
     result is News, not a Case Study.
   - `people`: a named person + what they just said/did (the URL points to it)
     + why she should follow them. Never invented, never a listicle entry.

6. **Validate + persist:**
   ```bash
   python backend/pipeline.py --write backend/curated.json
   ```
   This enforces the rules again, dedupes, drops seen URLs, caps per-section counts,
   writes the dated issue + rebuilds the index. View with `cd frontend && npm run dev`.

## HARD RULES (this feed exists to make her credible with clients)

1. **Only real URLs.** Every item's `url` must come from the RSS `pool` OR a real
   `WebSearch`/`WebFetch` result you actually retrieved. **Never** invent items, tools,
   people, quotes, or URLs from memory. If you didn't find it, omit it.
2. **Grounded summaries.** `summary` and `terms` must come from the item's source (the fetched
   article, or the blurb/snippet on fetch failure) — never invent facts, figures, dates, names,
   or definitions.
3. **Exclude `seen_urls`** (items from prior issues) — no repeats.
3. **Dedupe** near-identical stories; keep the best single source.
4. **Sections:** use exactly the `id`s/`label`s from `pool.json`; respect each
   `max_items`. **Brief:** the `brief_count` single most important items across all
   sections. List each as `{ "url": "<url of a section item>" }` — the
   pipeline copies the full card from its section automatically.
5. `why_it_matters`: ONE action-phrased sentence for an AI consultant (a tool to
   try, a pitch to make, a risk to flag, a person to follow). No clickbait.
6. `signal_tag`: one of `trending` / `new` / `shift`.
7. Rank by relevance to `relevance_focus` AND topicality. Quality over quantity — fewer
   than the max is fine if the pool is thin.

## Notes

- Tune sources/focus/counts in `backend/config.yaml` (the only tuning file).
- The Anthropic-API engine (`backend/curator.py`, run via `python backend/pipeline.py`
  with no args) still exists as an optional autonomous fallback — not the default.
- `enrich.py` is the seam for the future ROI/case-study layer; leave it a pass-through.
