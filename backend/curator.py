"""API curator — OPTIONAL engine. Turns the candidate pool into a curated issue
via one structured Claude API call. Used by `pipeline.py` (no args) when you have
an ANTHROPIC_API_KEY and want a fully-autonomous run.

The default, no-cost engine is Claude Code itself (see CLAUDE.md, `--collect` /
`--write`). This module is kept so the API path still works if you ever want it.

Hard guarantees (enforced here + in validate.py):
- The model may ONLY rank/summarize items present in the provided pool. Every
  output item must carry a `url` from the input. No invented items.
- Items whose URL appears in seen_urls (prior issues) are excluded.
- Output is validated against validate.normalize — the shared rule set.
"""

from __future__ import annotations

import json
from typing import Optional

import anthropic
from pydantic import BaseModel

import validate
from config import Config

MODEL = "claude-opus-4-8"


class Term(BaseModel):
    term: str
    definition: str


class Item(BaseModel):
    section: str
    headline: str
    summary: str
    why_it_matters: str
    terms: list[Term] = []
    url: str
    source_name: str
    signal_tag: str
    published_at: Optional[str] = None


class SectionOut(BaseModel):
    id: str
    label: str
    items: list[Item]


class CuratorOutput(BaseModel):
    brief: list[Item]
    sections: list[SectionOut]


def _system_prompt(cfg: Config) -> str:
    section_spec = "\n".join(
        f'  - id "{s.id}" (label "{s.label}"): up to {s.max_items} items'
        for s in cfg.sections
    )
    return f"""You are the curator for "{cfg.title}", a private intelligence feed for a busy
AI consultant. You receive a pool of real, already-fetched candidate items and turn
them into one tight, high-signal issue.

RELEVANCE FOCUS:
{cfg.relevance_focus}

SECTIONS (use exactly these ids and labels):
{section_spec}

THE BRIEF: also choose the {cfg.brief_count} single most important items across all
sections — the "must-know" set the reader can skim in 30 seconds. Brief items are
copies of items that also appear in their section.

THE READER: a sharp marketer moving into AI consulting — NOT a technical expert, but learning.
Write so she understands each item without opening the source and without prior jargon knowledge.
Explain terminology in plain English; never assume she knows an acronym or technical term.

FOR EACH ITEM:
- section: one of the section ids above.
- headline: concise, factual, no clickbait.
- summary: 2–4 plain-language sentences that make WHO / WHAT / WHERE / WHEN / HOW clear naturally
  (do NOT label these — just write so they surface). Gloss any unavoidable jargon in-line where it
  reads well, e.g. 'its AI "shopping assistant" (a chatbot that helps shoppers buy)'. Ground it in
  the provided item text — do not invent facts, figures, dates, or names.
- why_it_matters: ONE sentence on why it matters to an AI consultant (a tool to try, a cost-saving
  angle, a person to follow, a shift to track).
- terms: a short glossary — [{"term","definition"}] — defining any genuinely technical term on the
  card in one plain sentence each. Define only terms that actually appear and would trip up a
  non-expert; use [] when nothing needs it. No circular or jargon-laden definitions.
- url: copy the item's real URL from the input — VERBATIM.
- source_name: the item's source.
- signal_tag: one of "trending", "new", "shift".
- published_at: copy if present, else null.

HARD RULES — this feed exists to make the reader credible in front of clients:
1. Use ONLY items from the provided pool. NEVER add tools, people, news, quotes, or
   URLs from your own knowledge. Every output item's url MUST appear in the input.
2. If a field isn't supported by the item, omit it (null) rather than guessing.
3. Drop any item whose url appears in the provided "already seen" list.
4. Deduplicate near-identical stories; keep the best single source.
5. Rank by relevance to the focus AND topicality. Quality over quantity — it is fine
   to return fewer than the max if the pool is thin."""


def curate(cfg: Config, pool: list[dict], seen_urls: list[str]) -> Optional[dict]:
    """Returns the issue body {"brief": [...], "sections": [...]} or None."""
    if not pool:
        print("  [curator] empty pool — nothing to curate")
        return None

    try:
        client = anthropic.Anthropic()
    except Exception as exc:  # noqa: BLE001
        print(f"  [curator] cannot init Anthropic client: {exc}")
        return None

    user_payload = {
        "candidate_pool": pool,
        "already_seen_urls": seen_urls,
        "valid_signal_tags": list(validate.SIGNAL_TAGS),
    }

    try:
        # messages.parse injects output_config={"format": <schema>} from output_format
        # — don't pass our own output_config (collides). effort defaults to "high".
        resp = client.messages.parse(
            model=MODEL,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=[
                {
                    "type": "text",
                    "text": _system_prompt(cfg),
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": "Curate this issue from the pool below. Return brief + sections.\n\n"
                    + json.dumps(user_payload, ensure_ascii=False),
                }
            ],
            output_format=CuratorOutput,
        )
    except anthropic.APIError as exc:
        print(f"  [curator] API error: {exc}")
        return None

    if resp.parsed_output is None:
        print(f"  [curator] no structured output (stop_reason={resp.stop_reason})")
        return None

    out = resp.parsed_output
    brief = [it.model_dump() for it in out.brief]
    sections = [
        {"id": s.id, "label": s.label, "items": [it.model_dump() for it in s.items]}
        for s in out.sections
    ]
    nb, ns = validate.normalize(cfg, brief, sections, seen_urls)
    return {"brief": nb, "sections": ns}
