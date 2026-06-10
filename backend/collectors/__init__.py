"""Collectors fetch raw candidate items from sources.

Every collector returns a list of RawItem with a uniform shape, so the curator
treats all sources identically. Adding a source type means adding one collector
with this same return contract — no curator changes.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict


@dataclass
class RawItem:
    title: str
    url: str
    source_name: str
    summary: str = ""
    published_at: str | None = None  # ISO date if known
    origin: str = ""  # "rss" | "web_search" — provenance, for debugging

    def to_dict(self) -> dict:
        return asdict(self)
