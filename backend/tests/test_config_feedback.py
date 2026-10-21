"""Tests for the reader-feedback settings in config.py.

The feedback loop adds a `feedback:` block to config.yaml (tuning numbers) and an
optional backend/steer.yaml (the active steer — a short paragraph of learned
instructions for the curator, plus per-section weights). Both are merged into the
same Config object the rest of the pipeline already reads.
"""

import config
from config import Config, SectionConfig, load_config

BASE_YAML = """
title: "T"
cadence: weekly
brief_count: 3
relevance_focus: >
  A focus.
lookback_days: 14
min_items_to_publish: 4
sections:
  - id: tools
    label: "Tools"
    max_items: 5
  - id: news
    label: "News"
    max_items: 5
sources:
  rss: []
  web_search:
    queries: []
gemini:
  model: "gemini-3.1-pro-preview"
"""


def make_cfg(brief_count=3):
    """The ten-kwarg constructor the existing tests use — every new field must
    keep a default so this keeps working."""
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
        gemini_model="gemini-3.1-pro-preview",
        min_items_to_publish=4,
    )


def write_yaml(tmp_path, extra=""):
    path = tmp_path / "config.yaml"
    path.write_text(BASE_YAML + extra)
    return path


def test_existing_ten_kwarg_config_still_constructs_with_feedback_defaults():
    cfg = make_cfg()
    assert cfg.feedback_half_life_days == 30.0
    assert cfg.feedback_min_explicit_for_proposal == 10
    assert cfg.feedback_top_k == 15
    assert cfg.steer is None
    assert cfg.section_weights == {}


def test_feedback_defaults_when_block_absent(tmp_path):
    cfg = load_config(write_yaml(tmp_path), steer_path=tmp_path / "missing.yaml")
    assert cfg.feedback_half_life_days == 30.0
    assert cfg.feedback_min_explicit_for_proposal == 10
    assert cfg.feedback_top_k == 15


def test_feedback_values_are_parsed(tmp_path):
    path = write_yaml(
        tmp_path,
        "\nfeedback:\n  half_life_days: 12\n"
        "  min_explicit_for_proposal: 4\n  top_k: 7\n",
    )
    cfg = load_config(path, steer_path=tmp_path / "missing.yaml")
    assert cfg.feedback_half_life_days == 12.0
    assert cfg.feedback_min_explicit_for_proposal == 4
    assert cfg.feedback_top_k == 7


def test_steer_is_none_when_steer_file_is_absent(tmp_path):
    cfg = load_config(write_yaml(tmp_path), steer_path=tmp_path / "missing.yaml")
    assert cfg.steer is None
    assert cfg.section_weights == {}


def test_steer_and_weights_are_merged_when_file_exists(tmp_path):
    steer = tmp_path / "steer.yaml"
    steer.write_text(
        "steer: |\n  Favour hands-on tools she can try today.\n"
        "section_weights:\n  tools: 1.3\n  news: 0.7\n"
    )
    cfg = load_config(write_yaml(tmp_path), steer_path=steer)
    assert "hands-on tools" in cfg.steer
    assert cfg.section_weights == {"tools": 1.3, "news": 0.7}


def test_unknown_section_ids_in_steer_are_dropped(tmp_path):
    steer = tmp_path / "steer.yaml"
    steer.write_text(
        "steer: Favour tools.\nsection_weights:\n  tools: 1.5\n  made_up: 2.0\n"
    )
    cfg = load_config(write_yaml(tmp_path), steer_path=steer)
    assert cfg.section_weights == {"tools": 1.5}


def test_blank_steer_string_leaves_steer_unset(tmp_path):
    steer = tmp_path / "steer.yaml"
    steer.write_text("steer: '   '\nsection_weights:\n  tools: 1.5\n")
    cfg = load_config(write_yaml(tmp_path), steer_path=steer)
    assert cfg.steer is None
    assert cfg.section_weights == {}


def test_steer_path_constant_points_at_backend_steer_yaml():
    assert config.STEER_PATH.name == "steer.yaml"
    assert config.STEER_PATH.parent == config.CONFIG_PATH.parent
