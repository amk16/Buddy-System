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

2. **Read `backend/pool.json`.** If it carries a non-null `reader_profile.steer`, treat
   that as an editorial instruction learned from her reactions to past issues, and let
   it shape ranking and choice below (rule 8 under HARD RULES says the same thing).

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
   try, a pitch to make, a risk to flag, a person to follow). No clickbait, and
   no deadline countdowns — dates belong in the `summary`, grounded.
6. `signal_tag`: one of `trending` / `new` / `shift`.
7. Rank by relevance to `relevance_focus` AND topicality. Quality over quantity — fewer
   than the max is fine if the pool is thin.
8. If pool.json carries a non-null `reader_profile.steer`, obey it when ranking and
   choosing — it is learned from her reactions to past issues.

## Engines

There are three ways to produce an issue; they share the same rules
(`validate.py`), storage (`store.py`), and output schema (`curate_schema.py`):

1. **Claude Code (default, no API cost)** — the `--collect` / curate / `--write`
   flow above. You are the curation engine.
2. **Gemini (autonomous stream)** — `python backend/pipeline.py --gemini`. Uses
   `gemini-3.1-pro-preview` (set in `config.yaml`) with grounded Google Search to
   find trending items and curate them with no human in the loop. Needs
   `GEMINI_API_KEY`. This is what the scheduled **GitHub Action** runs
   (`.github/workflows/pulse.yml`): it generates an issue and pushes to `main`, so
   Vercel rebuilds and publishes automatically. Change cadence by editing the one
   `cron:` line; trigger ad-hoc runs from the Actions tab ("Run workflow").
3. **Anthropic API (optional)** — `python backend/pipeline.py` (no args). The
   original autonomous fallback.

Both autonomous engines obey `min_items_to_publish` (in `config.yaml`): a run that
produces fewer items aborts and publishes nothing, so an unattended stream never
ships a threadbare issue. The Gemini grounding path resolves Google's expiring
`vertexaisearch` redirect URLs to real publisher links and keeps **only**
grounding-cited URLs (`url_resolve.py` + `collectors/web_gemini.py`) — same
anti-hallucination guarantee as the Anthropic `web` collector.

### Reader feedback

Her reactions to cards and issues become a reader profile and a proposed steer; see the
"Reader feedback loop" section in `README.md` for setup and the full flow. The two
verbs: `python backend/pipeline.py --profile` regenerates the profile and local HTML
report from her reactions, and `python backend/pipeline.py --accept-steer` (Ali only)
makes a proposed steer active by writing `backend/steer.yaml`.

**You are also the steer proposer** (after step 6, no API cost). A `--write` run rebuilds the
profile, and once there are at least `min_explicit_for_proposal` explicit reactions (the
`feedback:` block in `config.yaml`) it writes **`backend/profile_evidence.json`**: the
cards she actually reacted to, the chip tallies, the current/ideal section mix, and the
`output_schema` your answer must match. When that file appears:

1. Read `backend/profile_evidence.json` — the evidence in it is the only thing you may
   reason over.
2. Write `backend/profile_proposal.json` matching its `output_schema`:
   `emergent_axes` (each with `evidence_urls` chosen **ONLY** from the urls present in
   that evidence — the same rule as HARD RULE 1: never a url from memory or from
   anywhere else), `profile_summary` and `proposed_steer` at most **120 words each**, and
   `section_weights` over the section ids the evidence gives you.
3. Run:
   ```bash
   python backend/pipeline.py --profile --proposal backend/profile_proposal.json
   ```
   This validates the proposal and writes it to `profile/proposal.yaml` as a *proposed*
   steer. It does not take effect until Ali runs `--accept-steer`.

## Notes

- Tune sources/focus/counts/model/floor in `backend/config.yaml` (the only tuning file).
- `enrich.py` is the seam for the future ROI/case-study layer; leave it a pass-through.
