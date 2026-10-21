"""Load and validate config.yaml — the single tuning surface for the feed."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml

CONFIG_PATH = Path(__file__).parent / "config.yaml"
# The ACTIVE steer: a short paragraph of curation instructions learned from the
# reader's reactions, written here only when Ali accepts a proposal
# (`pipeline.py --accept-steer`). Absent until then.
STEER_PATH = Path(__file__).parent / "steer.yaml"


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
    # --- reader-feedback loop (all optional, all defaulted) -------------------
    # A reaction's weight halves every this many days, so old taste fades out.
    feedback_half_life_days: float = 30.0
    # Below this many explicit reactions (More / Loved / Less) the loop stays
    # descriptive: no LLM proposal, and the "ideal" section mix just mirrors the
    # current one.
    feedback_min_explicit_for_proposal: int = 10
    # How many loved / less example cards the proposal prompt gets to see.
    feedback_top_k: int = 15
    # The accepted steer paragraph, or None when no steer is active.
    steer: str | None = None
    # Per-section multipliers from the accepted steer, e.g. {"tools": 1.3}.
    section_weights: dict[str, float] = field(default_factory=dict)

    @property
    def section_ids(self) -> list[str]:
        return [s.id for s in self.sections]


def load_config(path: Path = CONFIG_PATH, steer_path: Path = STEER_PATH) -> Config:
    raw = yaml.safe_load(path.read_text())

    sections = [
        SectionConfig(id=s["id"], label=s["label"], max_items=int(s["max_items"]))
        for s in raw["sections"]
    ]
    sources = raw.get("sources", {})
    gemini = raw.get("gemini", {}) or {}
    feedback = raw.get("feedback", {}) or {}

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
        feedback_half_life_days=float(feedback.get("half_life_days", 30.0)),
        feedback_min_explicit_for_proposal=int(
            feedback.get("min_explicit_for_proposal", 10)
        ),
        feedback_top_k=int(feedback.get("top_k", 15)),
    )

    if not cfg.sections:
        raise ValueError("config.yaml must define at least one section")

    _merge_steer(cfg, steer_path)
    return cfg


def _merge_steer(cfg: Config, steer_path: Path) -> None:
    """Fold backend/steer.yaml into the config, if it exists.

    A missing or unreadable steer file simply means no steer is active — that is
    the normal state, not an error, so nothing is raised."""
    try:
        if not steer_path.exists():
            return
        data = yaml.safe_load(steer_path.read_text()) or {}
    except (OSError, yaml.YAMLError) as exc:
        print(f"  [config] ignoring unreadable steer at {steer_path}: {exc}")
        return
    if not isinstance(data, dict):
        return

    steer = data.get("steer")
    if not isinstance(steer, str) or not steer.strip():
        return
    cfg.steer = steer.strip()

    weights: dict[str, float] = {}
    known = set(cfg.section_ids)
    for key, value in (data.get("section_weights") or {}).items():
        if key in known:
            try:
                weights[key] = float(value)
            except (TypeError, ValueError):
                continue
    cfg.section_weights = weights
