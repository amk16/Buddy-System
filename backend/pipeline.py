"""Pipeline entrypoint.

Two engines for the LLM step:

  • Claude Code (default, no API cost) — run in two steps with a Claude Code
    session doing the curation in between (see CLAUDE.md):
        python backend/pipeline.py --collect          # RSS -> backend/pool.json
        # ...Claude Code reads pool.json, curates, writes backend/curated.json...
        python backend/pipeline.py --write backend/curated.json

  • Anthropic API (optional, ~cents/issue) — fully autonomous, needs a key:
        python backend/pipeline.py                     # collect + curate + write

  • Sample (no key, demo data for UI work):
        python backend/pipeline.py --sample

The whole thing writes static JSON, so a scheduler (or `claude -p` on a cron)
can drive it later with no rearchitecting.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Auto-load backend/.env so the API key (and any future secrets) are picked up
# without needing to `export`. Falls back silently to real env vars if missing.
try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

import store
import validate
from config import Config, load_config
from collectors.rss import collect_rss
from collectors.web import collect_web_search
from curator import curate
from enrich import enrich
from notify import notify

POOL_PATH = Path(__file__).resolve().parent / "pool.json"


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _dedupe_pool(items: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for it in items:
        url = it.get("url")
        if not url or url in seen:
            continue
        seen.add(url)
        out.append(it)
    return out


def _build_issue(cfg: Config, issue_id: str, body: dict) -> dict:
    return {
        "id": issue_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "title": cfg.title,
        "brief": body.get("brief", []),
        "sections": body.get("sections", []),
    }


def _persist(cfg: Config, body: dict) -> int:
    body = enrich(body)
    if not any(sec.get("items") for sec in body.get("sections", [])):
        print("No valid items after validation. Nothing written.")
        return 1
    issue = _build_issue(cfg, store.next_issue_id(_today()), body)
    path = store.write_issue(issue)
    notify(issue)
    total = sum(len(s["items"]) for s in issue["sections"])
    print(f"Wrote {path}  ({total} items, {len(issue['brief'])} in the brief)")
    return 0


# --- Step 1: collect (free, no LLM) — for the Claude Code engine -------------
def collect_only() -> int:
    cfg = load_config()
    print(f"Collecting RSS for {_today()} (Claude Code will curate)…")
    rss_items = collect_rss(cfg.rss_feeds, cfg.lookback_days)
    pool = _dedupe_pool([it.to_dict() for it in rss_items])

    payload = {
        "generated_for_date": _today(),
        "title": cfg.title,
        "relevance_focus": cfg.relevance_focus,
        "lookback_days": cfg.lookback_days,
        "brief_count": cfg.brief_count,
        "sections": [
            {"id": s.id, "label": s.label, "max_items": s.max_items}
            for s in cfg.sections
        ],
        "web_search_queries": cfg.web_search_queries,
        "valid_signal_tags": list(validate.SIGNAL_TAGS),
        "seen_urls": store.load_seen_urls(),
        "pool": pool,
    }
    POOL_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"Wrote {POOL_PATH}  ({len(pool)} RSS candidates)")
    print("Next: have Claude Code curate it (see CLAUDE.md), then:")
    print("  python backend/pipeline.py --write backend/curated.json")
    return 0


# --- Step 2: write (validate + persist a curated issue body) -----------------
def write_curated(path: str) -> int:
    cfg = load_config()
    try:
        body = json.loads(Path(path).read_text())
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Could not read curated issue at {path}: {exc}")
        return 1

    brief, sections = validate.normalize(
        cfg, body.get("brief", []), body.get("sections", []), store.load_seen_urls()
    )
    return _persist(cfg, {"brief": brief, "sections": sections})


# --- Optional: full autonomous API run ---------------------------------------
def run_api() -> int:
    cfg = load_config()
    print(f"AI Marketing Pulse — API run for {_today()}")
    print("Collecting…")
    rss_items = collect_rss(cfg.rss_feeds, cfg.lookback_days)
    web_items = collect_web_search(
        cfg.web_search_queries, cfg.lookback_days, cfg.relevance_focus
    )
    pool = _dedupe_pool([it.to_dict() for it in rss_items] + web_items)
    print(f"Pool: {len(pool)} unique candidate items")

    seen = store.load_seen_urls()
    print(f"Curating (excluding {len(seen)} previously-seen URLs)…")
    body = curate(cfg, pool, seen)
    if body is None:
        print("No issue produced (see warnings above). Nothing written.")
        return 1
    return _persist(cfg, body)


# --- Sample (demo data, no key) ----------------------------------------------
def write_sample() -> int:
    cfg = load_config()
    today = _today()

    def item(section, headline, summary, why, url, source, tag, terms=None):
        return {
            "section": section,
            "headline": headline,
            "summary": summary,
            "why_it_matters": why,
            "terms": terms or [],
            "url": url,
            "source_name": source,
            "signal_tag": tag,
            "published_at": today,
        }

    tools = [
        item("tools", "[SAMPLE] AI meeting-notes tool adds CRM auto-sync",
             "A note-taking app that records meetings and writes summaries with AI has added "
             "automatic syncing to CRMs (the software sales teams use to track customers). After "
             "a call, the notes and action items flow straight into the customer's record — no "
             "manual copying.",
             "A try-this tool that cuts sales-ops admin time — an easy cost-saving demo for clients.",
             "https://techcrunch.com/", "TechCrunch", "new",
             [{"term": "CRM", "definition": "Customer Relationship Management — software that stores "
               "a company's customer and sales data."}]),
        item("tools", "[SAMPLE] Open-source agent framework hits version 1.0",
             "A free, open-source toolkit for building AI \"agents\" reached its first stable "
             "release. It lets developers wire up software that can carry out multi-step tasks on "
             "its own, like pulling data and drafting replies.",
             "Lowers the cost of building the internal automations clients keep asking about.",
             "https://venturebeat.com/", "VentureBeat", "trending",
             [{"term": "AI agent", "definition": "AI that can take actions and complete tasks on its "
               "own, not just answer questions."},
              {"term": "open-source", "definition": "Software whose code is free to use and modify."}]),
    ]
    news = [
        item("news", "[SAMPLE] Major retailer reports 30% support-cost cut with AI",
             "A large retailer said an AI chatbot handling customer questions cut its support costs "
             "by about 30% over a few months, by resolving common queries without a human agent.",
             "A concrete ROI number to cite in cost-saving pitches.",
             "https://www.technologyreview.com/", "MIT Tech Review", "shift",
             [{"term": "ROI", "definition": "Return on investment — what you get back versus what you "
               "spent."}]),
        item("news", "[SAMPLE] New ad-platform AI targeting rolls out in India",
             "A major ad platform launched AI tools in India that pick audiences and build creative "
             "automatically, aiming to lower the effort of running campaigns.",
             "Directly relevant to marketing clients; a talking point for socials.",
             "https://www.marketingdive.com/", "Marketing Dive", "new"),
    ]
    people = [
        item("people", "[SAMPLE] Enterprise-AI founder on where automation pays off",
             "The founder of an enterprise-AI company explained, in a recent interview, which "
             "business tasks actually save money when automated — and which don't yet.",
             "Worth following for case-study angles and pitch framing.",
             "https://www.theverge.com/", "The Verge", "trending"),
    ]
    body = {
        "brief": [news[0], tools[0], people[0]],
        "sections": [
            {"id": "tools", "label": "🛠 Tools", "items": tools},
            {"id": "news", "label": "📰 News", "items": news},
            {"id": "people", "label": "👤 People to Watch", "items": people},
        ],
    }
    issue = _build_issue(cfg, store.next_issue_id(today), body)
    issue["title"] = f"{cfg.title} (sample)"
    path = store.write_issue(issue)
    print(f"Wrote SAMPLE issue {path} (demo data — not real curation)")
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--sample" in args:
        raise SystemExit(write_sample())
    if "--collect" in args:
        raise SystemExit(collect_only())
    if "--write" in args:
        i = args.index("--write")
        if i + 1 >= len(args):
            print("Usage: python backend/pipeline.py --write <curated.json>")
            raise SystemExit(2)
        raise SystemExit(write_curated(args[i + 1]))
    raise SystemExit(run_api())
