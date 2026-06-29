"""Load and validate config.yaml — the single tuning surface for the feed."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml

CONFIG_PATH = Path(__file__).parent / "config.yaml"


@dataclass
class SectionConfig:
    id: str
    label: str
    max_items: int


@dataclass
class Config:
    title: str
    cadence: str
    brief_count: int
    relevance_focus: str
    lookback_days: int
    sections: list[SectionConfig]
    rss_feeds: list[str]
    web_search_queries: list[str]
    gemini_model: str
    min_items_to_publish: int

    @property
    def section_ids(self) -> list[str]:
        return [s.id for s in self.sections]


def load_config(path: Path = CONFIG_PATH) -> Config:
    raw = yaml.safe_load(path.read_text())

    sections = [
        SectionConfig(id=s["id"], label=s["label"], max_items=int(s["max_items"]))
        for s in raw["sections"]
    ]
    sources = raw.get("sources", {})
    gemini = raw.get("gemini", {}) or {}

    cfg = Config(
        title=raw["title"],
        cadence=raw.get("cadence", "weekly"),
        brief_count=int(raw.get("brief_count", 3)),
        relevance_focus=raw["relevance_focus"].strip(),
        lookback_days=int(raw.get("lookback_days", 14)),
        sections=sections,
        rss_feeds=list(sources.get("rss", [])),
        web_search_queries=list(sources.get("web_search", {}).get("queries", [])),
        gemini_model=str(gemini.get("model", "gemini-3.1-pro-preview")),
        min_items_to_publish=int(raw.get("min_items_to_publish", 4)),
    )

    if not cfg.sections:
        raise ValueError("config.yaml must define at least one section")
    return cfg
