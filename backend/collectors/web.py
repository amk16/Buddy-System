"""Web-search collector — grounded trending items via Claude's web_search tool.

Uses the Anthropic server-side web_search tool so every item comes back with a
REAL url from an actual search result, never from model memory. This is the
anti-hallucination guarantee for the "trending" half of the pool. On any error
(no API key, network), it degrades to an empty list so an RSS-only run still works.
"""

from __future__ import annotations

import json
import re

import anthropic

MODEL = "claude-opus-4-8"


def _build_prompt(queries: list[str], lookback_days: int, focus: str) -> str:
    query_lines = "\n".join(f"- {q}" for q in queries)
    return f"""Use the web_search tool to find recent, trending items for an AI consultant.

Relevance focus:
{focus}

Run searches around these angles (adapt wording as useful):
{query_lines}

Rules:
- Only include items published within the last {lookback_days} days.
- Every item MUST have a real URL that came from a search result. Do NOT invent
  items, tools, people, or URLs from memory. If you didn't find it via search, omit it.
- Prefer concrete, high-signal items (a tool launch, a funding round, a named
  person's move, a cost-saving result) over vague trend pieces.

After searching, output ONLY a JSON array (no prose, no markdown fences) of up to
20 objects with exactly these keys:
  "title"        - the item's headline
  "url"          - the real source URL from search
  "source_name"  - the publication or site name
  "published_at" - ISO date (YYYY-MM-DD) if known, else null
  "summary"      - one factual sentence about the item
"""


def _extract_json_array(text: str) -> list[dict]:
    # The model is asked for a bare array; be tolerant of stray prose/fences.
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if not match:
        return []
    try:
        data = json.loads(match.group(0))
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def collect_web_search(
    queries: list[str], lookback_days: int, focus: str
) -> list[dict]:
    """Returns raw dicts (title/url/source_name/published_at/summary)."""
    if not queries:
        return []

    try:
        client = anthropic.Anthropic()
    except Exception as exc:  # noqa: BLE001
        print(f"  [web] skipped: cannot init Anthropic client ({exc})")
        return []

    prompt = _build_prompt(queries, lookback_days, focus)
    messages = [{"role": "user", "content": prompt}]
    tools = [{"type": "web_search_20260209", "name": "web_search"}]

    try:
        # The server runs a search loop; pause_turn means "resume to continue".
        for _ in range(6):
            resp = client.messages.create(
                model=MODEL,
                max_tokens=12000,  # headroom so adaptive thinking + results don't truncate the JSON
                thinking={"type": "adaptive"},
                tools=tools,
                messages=messages,
            )
            if resp.stop_reason == "pause_turn":
                messages = [
                    {"role": "user", "content": prompt},
                    {"role": "assistant", "content": resp.content},
                ]
                continue
            break
    except anthropic.APIError as exc:
        print(f"  [web] skipped: web_search call failed ({exc})")
        return []

    text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
    raw = _extract_json_array(text)

    items: list[dict] = []
    for r in raw:
        url = (r.get("url") or "").strip()
        title = (r.get("title") or "").strip()
        if not url or not title:
            continue  # hard requirement: real URL + headline
        items.append(
            {
                "title": title,
                "url": url,
                "source_name": (r.get("source_name") or "").strip() or "Web",
                "summary": (r.get("summary") or "").strip(),
                "published_at": r.get("published_at"),
                "origin": "web_search",
            }
        )
    print(f"  [web] {len(items)} grounded trending items")
    return items
