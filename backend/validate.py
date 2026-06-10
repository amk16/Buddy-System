"""Issue validation/normalization — the single source of truth for the rules,
shared by BOTH engines (the Claude Code path via `--write`, and the API curator).

Enforces what no engine can be fully trusted to honor: valid section ids/labels,
per-section max_items, valid signal tags, well-formed URLs, seen-URL exclusion,
and cross-section dedupe. Items with empty summaries are dropped. The Brief is
resolved by URL against kept section items and inherits their full content.
"""

from __future__ import annotations

from config import Config

SIGNAL_TAGS = ("trending", "new", "shift")


SUMMARY_MAX = 900
TERM_MAX = 60
DEF_MAX = 240


def _clean_terms(raw_terms) -> list[dict]:
    """Accept only a list of {term, definition} string pairs; drop anything malformed."""
    if not isinstance(raw_terms, list):
        return []
    out = []
    for t in raw_terms:
        if not isinstance(t, dict):
            continue
        term = (t.get("term") or "").strip()[:TERM_MAX]
        definition = (t.get("definition") or "").strip()[:DEF_MAX]
        if term and definition:
            out.append({"term": term, "definition": definition})
    return out


def _clean_item(raw: dict, label_by_id: dict, seen: set[str]) -> dict | None:
    url = (raw.get("url") or "").strip()
    headline = (raw.get("headline") or "").strip()
    section = raw.get("section")
    if not url or not headline:
        return None
    if not (url.startswith("http://") or url.startswith("https://")):
        return None
    if section not in label_by_id:
        return None
    if url in seen:
        return None
    tag = raw.get("signal_tag")
    if tag not in SIGNAL_TAGS:
        tag = "new"
    return {
        "section": section,
        "headline": headline,
        "summary": (raw.get("summary") or "").strip()[:SUMMARY_MAX],
        "why_it_matters": (raw.get("why_it_matters") or "").strip(),
        "terms": _clean_terms(raw.get("terms")),
        "url": url,
        "source_name": (raw.get("source_name") or "").strip() or "Source",
        "signal_tag": tag,
        "published_at": raw.get("published_at"),
    }


def normalize(
    cfg: Config,
    brief: list[dict],
    sections: list[dict],
    seen_urls: list[str],
) -> tuple[list[dict], list[dict]]:
    seen = set(seen_urls)
    label_by_id = {s.id: s.label for s in cfg.sections}
    max_by_id = {s.id: s.max_items for s in cfg.sections}

    # Gather + clean every provided item (default its section to the block's id).
    cleaned: list[dict] = []
    for sec in sections or []:
        sec_id = sec.get("id")
        for raw in sec.get("items", []) or []:
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

    # Dedupe by URL across the whole issue (keep first occurrence).
    seen_local: set[str] = set()
    deduped: list[dict] = []
    for it in cleaned:
        if it["url"] in seen_local:
            continue
        seen_local.add(it["url"])
        deduped.append(it)

    out_sections = []
    for s in cfg.sections:
        items = [it for it in deduped if it["section"] == s.id][: max_by_id[s.id]]
        out_sections.append({"id": s.id, "label": s.label, "items": items})

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

    return out_brief[: cfg.brief_count], out_sections
