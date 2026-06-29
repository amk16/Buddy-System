"""Shared curation contract — the output schema and system prompt used by BOTH
autonomous engines (Anthropic ``curator.py`` and Gemini ``gemini_curator.py``).

Kept here so the two engines can never drift on the issue shape or the editorial
rules. No vendor SDK is imported, so either engine can use it without pulling the
other's dependency.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from config import Config


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


def system_prompt(cfg: Config) -> str:
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
- terms: a short glossary — [{{"term","definition"}}] — defining any genuinely technical term on the
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
5. Rank by relevance to the focus AND topicality. The pool is deep, so be generous:
   include EVERY item that clears the relevance bar, up to each section's cap — a
   fuller issue is the goal. Never pad with weak or off-focus items to hit a number,
   and never drop a strong one just to stay small. Returning fewer than the max is
   only for a genuinely thin pool.
6. Within EACH section, order the items strongest/most-relevant FIRST and weakest
   last — the dashboard reads top-down and any overflow is trimmed from the bottom,
   so the most useful items must lead."""
