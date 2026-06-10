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


def test_brief_cannot_point_at_item_dropped_for_empty_summary():
    cfg = make_cfg()
    bad = make_item("https://x.com/blank", summary="")
    brief, _ = run(cfg, [{"url": "https://x.com/blank"}], {"news": [bad]})
    assert brief == []
