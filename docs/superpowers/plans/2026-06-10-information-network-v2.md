# AI Marketing Pulse v2 — Information Network Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the feed's information network (4 sections incl. new Case Studies, 16 verified tiered RSS feeds, section-specific search queries) and harden the pipeline so blank Brief cards and empty summaries can never reach the reader.

**Architecture:** All changes live in `backend/` config + validation plus curation rules in `CLAUDE.md`. The frontend renders sections generically from issue JSON (verified in `frontend/src/App.tsx:88`), so no frontend changes. Validation changes go in `validate.normalize()`, which both engines share.

**Tech Stack:** Python 3.13 (no framework), pytest (new dev dependency), YAML config, React frontend (untouched).

**Spec:** `docs/superpowers/specs/2026-06-10-information-network-v2-design.md`

**Pre-verified facts (do not re-derive):**
- All 16 feed URLs in Task 4 were fetched on 2026-06-10 and returned valid RSS/Atom XML with recent items. `https://every.to/feed.xml` (404) and `https://www.theneurondaily.com/feed` (403) were candidates that FAILED verification — do not add them.
- The project is NOT yet a git repository; Task 1 initializes it. `.gitignore` already excludes `backend/.env`, `pool.json`, `curated.json`, `node_modules/`, `dist/`.
- There are no existing tests and pytest is not installed.
- `frontend/src/App.tsx` maps over `issue.sections` — new section ids render with zero frontend work.

---

### Task 1: Initialize git repository

The project has a `.gitignore` and README but no repo; later tasks commit, so this comes first.

**Files:** none created (repo metadata only)

- [ ] **Step 1: Init and make the baseline commit**

```bash
cd /Users/ehabriaz/Desktop/ai-marketing-pulse
git init
git add -A
git commit -m "chore: baseline before information-network v2"
```

- [ ] **Step 2: Verify the secret file is NOT tracked**

Run: `git ls-files | grep -c "backend/.env$"`
Expected: `0` (exit code 1 from grep is fine). If it prints `1`, STOP — run `git rm --cached backend/.env` and amend the commit before continuing.

---

### Task 2: Failing tests for validation hardening

**Files:**
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_validate.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add pytest to requirements and install**

Append to `backend/requirements.txt`:

```
pytest>=8.0
```

Run: `pip3 install pytest`
Expected: installs successfully (or "already satisfied").

- [ ] **Step 2: Create `backend/tests/conftest.py`** (makes `import validate` work regardless of CWD)

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
```

- [ ] **Step 3: Create `backend/tests/test_validate.py`**

```python
"""Tests for validate.normalize — the shared rule enforcement for both engines."""

import validate
from config import Config, SectionConfig


def make_cfg(brief_count=3):
    return Config(
        title="t",
        cadence="weekly",
        brief_count=brief_count,
        relevance_focus="f",
        lookback_days=14,
        sections=[
            SectionConfig(id="tools", label="Tools", max_items=5),
            SectionConfig(id="news", label="News", max_items=5),
        ],
        rss_feeds=[],
        web_search_queries=[],
    )


def make_item(url, section="news", summary="A real grounded summary.", **overrides):
    item = {
        "section": section,
        "headline": f"Headline for {url}",
        "summary": summary,
        "why_it_matters": "Try it with a client.",
        "terms": [],
        "url": url,
        "source_name": "Source",
        "signal_tag": "new",
        "published_at": "2026-06-10",
    }
    item.update(overrides)
    return item


def run(cfg, brief, items_by_section):
    sections = [
        {"id": sec_id, "items": items} for sec_id, items in items_by_section.items()
    ]
    return validate.normalize(cfg, brief, sections, seen_urls=[])


# --- Regression coverage of existing behavior --------------------------------

def test_dedupes_across_sections_and_caps_max_items():
    cfg = make_cfg()
    dup = make_item("https://x.com/a")
    extra = [make_item(f"https://x.com/n{i}") for i in range(6)]
    _, sections = run(cfg, [], {"news": [dup, dup] + extra})
    news = next(s for s in sections if s["id"] == "news")
    urls = [it["url"] for it in news["items"]]
    assert len(urls) == len(set(urls))
    assert len(news["items"]) == 5  # max_items cap


def test_seen_urls_are_excluded():
    cfg = make_cfg()
    item = make_item("https://x.com/seen")
    _, sections = validate.normalize(
        cfg, [], [{"id": "news", "items": [item]}], seen_urls=["https://x.com/seen"]
    )
    assert all(not s["items"] for s in sections)


# --- New: empty-summary gate --------------------------------------------------

def test_item_with_empty_summary_is_dropped():
    cfg = make_cfg()
    bad = make_item("https://x.com/blank", summary="")
    good = make_item("https://x.com/ok")
    _, sections = run(cfg, [], {"news": [bad, good]})
    news = next(s for s in sections if s["id"] == "news")
    assert [it["url"] for it in news["items"]] == ["https://x.com/ok"]


def test_whitespace_summary_is_dropped():
    cfg = make_cfg()
    bad = make_item("https://x.com/ws", summary="   ")
    _, sections = run(cfg, [], {"news": [bad]})
    assert all(not s["items"] for s in sections)


# --- New: brief auto-fill from the kept section card --------------------------

def test_brief_inherits_full_section_card_content():
    cfg = make_cfg()
    full = make_item("https://x.com/a", summary="The full summary with a number: 30%.",
                     terms=[{"term": "ROI", "definition": "Return on investment."}])
    blank_brief_entry = make_item("https://x.com/a", summary="", terms=[])
    brief, _ = run(cfg, [blank_brief_entry], {"news": [full]})
    assert len(brief) == 1
    assert brief[0]["summary"] == "The full summary with a number: 30%."
    assert brief[0]["terms"] == [{"term": "ROI", "definition": "Return on investment."}]


def test_brief_entry_may_be_url_only():
    cfg = make_cfg()
    full = make_item("https://x.com/a")
    brief, _ = run(cfg, [{"url": "https://x.com/a"}], {"news": [full]})
    assert len(brief) == 1
    assert brief[0]["headline"] == full["headline"]


def test_brief_url_not_kept_in_any_section_is_dropped():
    cfg = make_cfg()
    full = make_item("https://x.com/a")
    brief, _ = run(cfg, [{"url": "https://x.com/other"}], {"news": [full]})
    assert brief == []


def test_brief_dedupes_and_respects_brief_count():
    cfg = make_cfg(brief_count=2)
    items = [make_item(f"https://x.com/{i}") for i in range(3)]
    entries = [{"url": it["url"]} for it in items] + [{"url": items[0]["url"]}]
    brief, _ = run(cfg, entries, {"news": items})
    assert [b["url"] for b in brief] == [items[0]["url"], items[1]["url"]]
```

- [ ] **Step 4: Run tests, verify the NEW ones fail and regressions pass**

Run: `cd /Users/ehabriaz/Desktop/ai-marketing-pulse/backend && python3 -m pytest tests/ -v`
Expected: 3 PASS (`test_dedupes_across_sections_and_caps_max_items`, `test_seen_urls_are_excluded`, and `test_brief_url_not_kept_in_any_section_is_dropped` — the old code also drops unknown brief URLs). 5 FAIL (`test_item_with_empty_summary_is_dropped`, `test_whitespace_summary_is_dropped`, `test_brief_inherits_full_section_card_content`, `test_brief_entry_may_be_url_only`, `test_brief_dedupes_and_respects_brief_count`) because current code keeps empty-summary items and requires brief entries to be full valid items.

- [ ] **Step 5: Commit the failing tests**

```bash
cd /Users/ehabriaz/Desktop/ai-marketing-pulse
git add backend/tests/ backend/requirements.txt
git commit -m "test: validation rules for brief auto-fill and empty-summary gate"
```

---

### Task 3: Implement validation hardening

**Files:**
- Modify: `backend/validate.py:74-108` (the `normalize()` body)
- Test: `backend/tests/test_validate.py` (written in Task 2)

- [ ] **Step 1: Add the empty-summary gate in the gathering loop**

In `normalize()`, replace:

```python
            item = {**raw, "section": raw.get("section", sec_id)}
            c = _clean_item(item, label_by_id, seen)
            if c:
                cleaned.append(c)
```

with:

```python
            item = {**raw, "section": raw.get("section", sec_id)}
            c = _clean_item(item, label_by_id, seen)
            if not c:
                continue
            if not c["summary"]:
                # Curation rules require a summary even for blocked pages (use the
                # blurb); empty means the rule was violated — never ship it.
                print(f"Dropped (empty summary): {c['headline'][:70]}")
                continue
            cleaned.append(c)
```

- [ ] **Step 2: Replace the brief loop with URL-lookup auto-fill**

In `normalize()`, replace:

```python
    kept = {it["url"] for sec in out_sections for it in sec["items"]}
    out_brief: list[dict] = []
    brief_seen: set[str] = set()
    for raw in brief or []:
        c = _clean_item(raw, label_by_id, seen)
        if not c or c["url"] not in kept or c["url"] in brief_seen:
            continue
        brief_seen.add(c["url"])
        out_brief.append(c)
```

with:

```python
    # The Brief is a set of pointers into kept section cards: each entry only
    # needs a url, and always inherits the section card's full content — a
    # blank Brief card is therefore impossible.
    kept_by_url = {it["url"]: it for sec in out_sections for it in sec["items"]}
    out_brief: list[dict] = []
    brief_seen: set[str] = set()
    for raw in brief or []:
        url = ((raw or {}).get("url") or "").strip()
        item = kept_by_url.get(url)
        if not item or url in brief_seen:
            continue
        brief_seen.add(url)
        out_brief.append(dict(item))
```

- [ ] **Step 3: Update the module docstring's last sentence**

Replace (in `backend/validate.py:6`):

```python
and cross-section dedupe. The Brief is filtered to items that survived in a section.
```

with:

```python
and cross-section dedupe. Items with empty summaries are dropped. The Brief is
resolved by URL against kept section items and inherits their full content.
```

- [ ] **Step 4: Run all tests, verify everything passes**

Run: `cd /Users/ehabriaz/Desktop/ai-marketing-pulse/backend && python3 -m pytest tests/ -v`
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/ehabriaz/Desktop/ai-marketing-pulse
git add backend/validate.py
git commit -m "feat: brief auto-fill by URL + empty-summary gate in validation"
```

---

### Task 4: Rebuild the source network in config.yaml

**Files:**
- Modify: `backend/config.yaml` (full rewrite below)

- [ ] **Step 1: Replace the entire contents of `backend/config.yaml` with:**

```yaml
# AI Marketing Pulse — the ONLY file you edit to tune the feed.
# Change cadence, topics, sources, item counts, and curation focus here.

title: "AI Marketing Pulse"

# Informational for v1 (runs are manual). Drives the date label only.
cadence: weekly

# How many "must-know" items appear in The Brief at the top.
brief_count: 3

# The lens the curator applies, in ranked order. Edit this to retarget the feed.
relevance_focus: >
  AI applied across business functions — operations, finance, sales, customer
  support, and marketing — for an AI consultant building credibility. Ranked
  priorities: (1) client-ready talking points she can repeat today (tools to
  recommend, case studies with numbers, risks to flag); (2) her own learning
  curve (plain-language understanding that compounds); (3) market radar
  (pricing shifts, new entrants, rising voices). A weaker story she can USE
  beats a bigger story she can't.

# Only consider items published within this many days.
lookback_days: 14

# Sections rendered in the dashboard, in order. Worst case 15 cards total.
sections:
  - id: tools
    label: "🛠 Tools"
    max_items: 5
  - id: news
    label: "📰 News"
    max_items: 5
  - id: case_studies
    label: "📊 Case Studies"
    max_items: 3
  - id: people
    label: "👤 People to Watch"
    max_items: 2

sources:
  # RSS feeds — free, automation-friendly. Bad/unreachable feeds are skipped at
  # runtime, but every feed below was verified live before being added.
  rss:
    # Tier 1 — practitioner voices (feeds People + Case Studies)
    - https://www.oneusefulthing.org/feed
    - https://www.bensbites.com/feed
    - https://www.lennysnewsletter.com/feed
    - https://www.exponentialview.co/feed
    - https://www.marketingaiinstitute.com/blog/rss.xml
    # Tier 2 — vertical trade press (feeds Case Studies + News across business functions)
    - https://www.customerexperiencedive.com/feeds/news/
    - https://www.cfodive.com/feeds/news/
    - https://www.supplychaindive.com/feeds/news/
    - https://www.retaildive.com/feeds/news/
    - https://www.ciodive.com/feeds/news/
    - https://www.hrdive.com/feeds/news/
    - https://www.zdnet.com/topic/artificial-intelligence/rss.xml
    # Tier 3 — general tech, pruned to the highest-signal
    - https://techcrunch.com/category/artificial-intelligence/feed/
    - https://venturebeat.com/category/ai/feed/
    - https://www.technologyreview.com/feed/
    - https://www.marketingdive.com/feeds/news/

  # Web-search queries — run via Claude's grounded web_search tool (real URLs).
  # Grouped by the section they mainly feed.
  web_search:
    queries:
      # tools
      - "new AI tools for business launched this week"
      - "AI tool launch for sales customer support finance teams"
      # case_studies
      - "enterprise AI case study cost savings results"
      - "company AI deployment ROI case study percent saved"
      - "AI customer service cost reduction case study"
      # news
      - "enterprise AI adoption news this week"
      # people
      - "AI leader interview enterprise automation advice"
```

- [ ] **Step 2: Verify the config loads and the collector runs against the new feeds**

Run: `cd /Users/ehabriaz/Desktop/ai-marketing-pulse && python3 -c "import sys; sys.path.insert(0,'backend'); from config import load_config; c=load_config(); print(c.section_ids, len(c.rss_feeds), 'feeds', len(c.web_search_queries), 'queries')"`
Expected: `['tools', 'news', 'case_studies', 'people'] 16 feeds 7 queries`

Run: `cd /Users/ehabriaz/Desktop/ai-marketing-pulse && python3 backend/pipeline.py --collect`
Expected: writes `backend/pool.json` with a candidate count noticeably above prior runs. Unreachable feeds print a skip warning — investigate only if a Tier 1/2 feed is skipped.

- [ ] **Step 3: Confirm new sources actually contributed to the pool**

Run:
```bash
cd /Users/ehabriaz/Desktop/ai-marketing-pulse && python3 -c "
import json, collections
pool = json.load(open('backend/pool.json'))['pool']
by_src = collections.Counter(it.get('source_name') or it.get('url','').split('/')[2] for it in pool)
print(len(pool), 'candidates'); [print(f'{n:4d}  {s}') for s, n in by_src.most_common()]"
```
Expected: candidates from Dive verticals (CX/CFO/Supply Chain/Retail/CIO/HR) and at least one Tier 1 newsletter appear. If a Tier 1 feed contributed nothing, check its items' dates against `lookback_days` before assuming breakage (newsletters post weekly).

- [ ] **Step 4: Commit**

```bash
cd /Users/ehabriaz/Desktop/ai-marketing-pulse
git add backend/config.yaml
git commit -m "feat: tiered 16-feed source network, case_studies section, ranked focus"
```

---

### Task 5: Tighten curation rules in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (three surgical edits)

- [ ] **Step 1: Update the Brief description in step 5.** Replace:

```
   **Brief:** the `brief_count` single most important items across all
   sections (copies of items that also appear in their section).
```

(this text lives in HARD RULES item 4) with:

```
   **Brief:** the `brief_count` single most important items across all
   sections. List each as `{ "url": "<url of a section item>" }` — the
   pipeline copies the full card from its section automatically.
```

- [ ] **Step 2: Add ranked priorities and card shapes to step 5.** Immediately after the `why_it_matters` bullet (`- \`why_it_matters\`: still ONE sentence — the consulting angle.`), replace that bullet and add a block, so the reader rules end with:

```
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
```

- [ ] **Step 3: Update HARD RULES item 5.** Replace:

```
5. `why_it_matters`: ONE sentence on why it matters to an AI consultant (a tool to try,
   a cost-saving angle, a person to follow, a shift to track). No clickbait.
```

with:

```
5. `why_it_matters`: ONE action-phrased sentence for an AI consultant (a tool to
   try, a pitch to make, a risk to flag, a person to follow). No clickbait.
```

- [ ] **Step 4: Sanity-read the modified CLAUDE.md**

Run: `grep -n "case_studies\|Ranked priorities\|Card shapes" /Users/ehabriaz/Desktop/ai-marketing-pulse/CLAUDE.md`
Expected: all three appear; no duplicated or orphaned bullets around the edits.

- [ ] **Step 5: Commit**

```bash
cd /Users/ehabriaz/Desktop/ai-marketing-pulse
git add CLAUDE.md
git commit -m "docs: ranked priorities, card shapes, action-phrased why_it_matters"
```

---

### Task 6: End-to-end verification

**Files:** none modified.

- [ ] **Step 1: Full test suite**

Run: `cd /Users/ehabriaz/Desktop/ai-marketing-pulse/backend && python3 -m pytest tests/ -v`
Expected: 8/8 PASS.

- [ ] **Step 2: Guard against an accidental real issue**

Do NOT run `--write` or `--sample` here: both publish into `frontend/public/issues/` and pollute the archive + seen-URL history. The full proof of the new network is the next real `/pulse` run, which requires a Claude session (web search + deep reads) and is intentionally out of scope for this plan.

- [ ] **Step 3: Verify nothing is left uncommitted**

Run: `cd /Users/ehabriaz/Desktop/ai-marketing-pulse && git status --short`
Expected: empty (pool.json is gitignored).

- [ ] **Step 4: Report**

Summarize for the user: tests green, pool counts per source from Task 4 Step 3, and that the next `/pulse` run is the acceptance test (expect: Case Studies populated, People ≤2 from named voices, no blank summaries anywhere).
