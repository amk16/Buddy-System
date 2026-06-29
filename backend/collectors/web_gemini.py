"""Gemini web-search collector — grounded trending items via Google Search.

The Gemini analog of ``collectors/web.py``. Uses the Gemini 3 Interactions API
with the ``google_search`` tool plus structured output, so the model both finds
recent items AND returns them in our shape in one call.

THE ANTI-HALLUCINATION GUARANTEE (mirrors web.py): a grounded model can still
*write* a wrong or invented URL inside its JSON. So we trust a URL ONLY when it is
backed by Google's grounding. In the Gemini 3 grounded flow the model emits each
item's URL as a ``vertexaisearch...`` grounding-redirect — those redirect tokens
are signed and search-backed by construction, so a redirect that RESOLVES to a
real publisher IS the proof. The flow:

  1. Ask Gemini (google_search) for candidate items in a structured schema.
  2. For each candidate URL: if it's a ``vertexaisearch`` grounding redirect,
     resolve it to its real publisher URL (url_resolve). That resolution succeeding
     is the grounding guarantee — an invented token won't resolve.
  3. Some responses also attach ``url_citation`` annotations; those resolved URLs
     form a secondary allow-list for any candidate that wrote a direct publisher URL.
  4. Emit the candidate with its real publisher URL. Drop anything whose URL is
     neither a resolvable redirect nor a cited URL, or that's stale.

On any error (no key, network, SDK shape drift) it degrades to ``[]`` so an
RSS-only run still produces an issue.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from pydantic import BaseModel

from gemini_interactions import citation_urls, output_text
from url_resolve import canonicalize, is_redirect, resolve_redirect


class _WebCandidate(BaseModel):
    title: str
    url: str
    source_name: Optional[str] = None
    published_at: Optional[str] = None  # ISO date if known
    summary: Optional[str] = None


class _WebCandidates(BaseModel):
    items: list[_WebCandidate] = []


def _build_prompt(queries: list[str], lookback_days: int, focus: str) -> str:
    query_lines = "\n".join(f"- {q}" for q in queries)
    return f"""Use Google Search to find recent, trending items for an AI consultant.

Relevance focus:
{focus}

Search around these angles (adapt wording as useful):
{query_lines}

Rules:
- Only include items published within the last {lookback_days} days.
- Every item MUST be something you actually found via search, with its real source
  URL. Do NOT invent items, tools, people, or URLs. If you didn't find it, omit it.
- Prefer concrete, high-signal items (a tool launch, a funding round, a named
  person's move, a cost-saving result) over vague trend pieces.

Return up to 40 items in the required JSON schema. For each: a factual `title`, the
source `url`, the `source_name` (publication), `published_at` (YYYY-MM-DD if known,
else null), and a one-sentence factual `summary`."""


def _resolve_real(url: str) -> Optional[str]:
    """Resolve one grounding redirect to a real publisher URL, or ``None`` if it
    won't resolve off the grounding host. Thread-pool friendly (no shared state)."""
    real = resolve_redirect(url)
    return real if real and not is_redirect(real) else None


def _build_allowed_map(urls: list[str]) -> dict[str, str]:
    """Resolve each unique citation redirect to its real publisher URL, returning
    ``{canonical_real_url: real_url}``. Skips anything that won't resolve."""
    allowed: dict[str, str] = {}
    for raw in dict.fromkeys(urls):  # dedupe, preserve order
        real = _resolve_real(raw)
        if real:
            allowed[canonicalize(real)] = real
    return allowed


def _parse_date(value) -> Optional[date]:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None


def collect_web_search_gemini(
    queries: list[str],
    lookback_days: int,
    focus: str,
    model: str,
) -> list[dict]:
    """Returns grounded RawItem-shaped dicts (title/url/source_name/published_at/
    summary/origin). Degrades to ``[]`` on any failure."""
    if not queries:
        return []

    try:
        from google import genai
    except ImportError:
        print("  [web-gemini] skipped: google-genai not installed")
        return []

    try:
        client = genai.Client()  # reads GEMINI_API_KEY / GOOGLE_API_KEY
    except Exception as exc:  # noqa: BLE001
        print(f"  [web-gemini] skipped: cannot init Gemini client ({exc})")
        return []

    try:
        interaction = client.interactions.create(
            model=model,
            input=_build_prompt(queries, lookback_days, focus),
            tools=[{"type": "google_search"}],
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": _WebCandidates.model_json_schema(),
            },
        )
    except Exception as exc:  # noqa: BLE001 - network/SDK/quota all degrade to []
        print(f"  [web-gemini] skipped: search call failed ({exc})")
        return []

    try:
        candidates = _WebCandidates.model_validate_json(
            output_text(interaction) or "{}"
        ).items
    except Exception as exc:  # noqa: BLE001
        print(f"  [web-gemini] skipped: unparseable output ({exc})")
        return []

    # In the grounded flow the model emits each item's URL as a Google grounding
    # redirect (vertexaisearch host) right in its JSON — those tokens are
    # search-backed by construction, so a redirect that RESOLVES to a real
    # publisher IS the grounding proof. Some responses also attach url_citation
    # annotations; we fold those in as a secondary allow-list. A candidate whose
    # URL is neither a resolvable redirect nor a cited URL is ungrounded -> dropped.
    allowed = _build_allowed_map(citation_urls(interaction))

    # Resolve every unique grounding-redirect candidate URL concurrently — done
    # sequentially this is ~6s/redirect and would stall a 20-item batch for minutes.
    redirects = list(
        dict.fromkeys(
            u for c in candidates
            if is_redirect(u := (c.url or "").strip())
        )
    )
    resolved_map: dict[str, str] = {}
    if redirects:
        with ThreadPoolExecutor(max_workers=8) as pool:
            for raw, real in zip(redirects, pool.map(_resolve_real, redirects)):
                if real:
                    resolved_map[raw] = real

    def _grounded_real_url(cand_url: str) -> Optional[str]:
        if not cand_url:
            return None
        if is_redirect(cand_url):
            return resolved_map.get(cand_url)
        # Direct (non-redirect) URL: trust only if it matches a grounding citation.
        return allowed.get(canonicalize(cand_url))

    cutoff = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).date()
    items: list[dict] = []
    for c in candidates:
        title = (c.title or "").strip()
        if not title:
            continue

        real = _grounded_real_url((c.url or "").strip())
        if not real:
            continue  # ungrounded -> drop (anti-hallucination)

        when = _parse_date(c.published_at)
        if when and when < cutoff:
            continue

        items.append(
            {
                "title": title,
                "url": real,
                "source_name": (c.source_name or "").strip() or "Web",
                "summary": (c.summary or "").strip(),
                "published_at": when.isoformat() if when else None,
                "origin": "web_search_gemini",
            }
        )

    print(f"  [web-gemini] {len(items)} grounded trending items")
    return items
