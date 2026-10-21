"""Tests for the READER PROFILE block — the learned steer carried into curation.

A "steer" is a short paragraph of instructions distilled from the reader's
reactions to past issues. When one is active it is spliced into the curator's
system prompt; when none is active the prompt must be exactly what it has always
been, so the Anthropic prompt cache keeps hitting.
"""

import json

import curate_schema
import curator
import pipeline
from config import Config, SectionConfig


def make_cfg(steer=None, section_weights=None):
    return Config(
        title="t",
        cadence="weekly",
        brief_count=3,
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
        steer=steer,
        section_weights=section_weights or {},
    )


STEER = "Favour hands-on tools she can try on a client workflow this week."


# --- reader_profile_block ----------------------------------------------------

def test_reader_profile_block_is_empty_without_a_steer():
    assert curate_schema.reader_profile_block(None) == ""
    assert curate_schema.reader_profile_block("") == ""


def test_reader_profile_block_carries_the_steer_text():
    block = curate_schema.reader_profile_block(STEER)
    assert "READER PROFILE" in block
    assert STEER in block


def test_reader_profile_block_renders_the_section_lean_line():
    block = curate_schema.reader_profile_block(STEER, {"tools": 1.3, "people": 0.7})
    assert "tools ×1.3" in block
    assert "people ×0.7" in block


def test_reader_profile_block_omits_the_lean_line_without_weights():
    assert "Section lean" not in curate_schema.reader_profile_block(STEER)


# --- system_prompt ------------------------------------------------------------

def test_system_prompt_is_unchanged_when_no_steer_is_given():
    cfg = make_cfg()
    assert "READER PROFILE" not in curate_schema.system_prompt(cfg)
    assert curate_schema.system_prompt(cfg) == curate_schema.system_prompt(cfg, None)


def test_system_prompt_with_a_steer_contains_the_block():
    cfg = make_cfg()
    prompt = curate_schema.system_prompt(cfg, STEER)
    assert "READER PROFILE" in prompt
    assert STEER in prompt


def test_system_prompt_places_the_block_right_after_the_reader_paragraph():
    cfg = make_cfg()
    plain = curate_schema.system_prompt(cfg)
    prompt = curate_schema.system_prompt(cfg, STEER)
    assert prompt.index("THE READER") < prompt.index("READER PROFILE")
    assert prompt.index("READER PROFILE") < prompt.index("FOR EACH ITEM")
    # Everything else is untouched: removing the inserted block restores the
    # original prompt byte for byte.
    start = prompt.index("READER PROFILE")
    end = prompt.index("FOR EACH ITEM")
    assert prompt[:start] + prompt[end:] == plain


def test_system_prompt_uses_the_config_section_weights():
    cfg = make_cfg(section_weights={"tools": 1.3})
    assert "tools ×1.3" in curate_schema.system_prompt(cfg, STEER)


# --- collect_only carries the profile into pool.json -------------------------

def test_collect_only_writes_the_reader_profile_into_pool_json(tmp_path, monkeypatch):
    pool_path = tmp_path / "pool.json"
    monkeypatch.setattr(pipeline, "POOL_PATH", pool_path)
    monkeypatch.setattr(pipeline, "collect_rss", lambda *a, **k: [])
    monkeypatch.setattr(pipeline.store, "load_seen_urls", lambda: [])
    monkeypatch.setattr(
        pipeline, "load_config", lambda: make_cfg(STEER, {"tools": 1.3})
    )

    assert pipeline.collect_only() == 0
    payload = json.loads(pool_path.read_text())
    assert payload["reader_profile"] == {
        "steer": STEER,
        "section_weights": {"tools": 1.3},
    }


def test_collect_only_writes_a_null_steer_when_none_is_active(tmp_path, monkeypatch):
    pool_path = tmp_path / "pool.json"
    monkeypatch.setattr(pipeline, "POOL_PATH", pool_path)
    monkeypatch.setattr(pipeline, "collect_rss", lambda *a, **k: [])
    monkeypatch.setattr(pipeline.store, "load_seen_urls", lambda: [])
    monkeypatch.setattr(pipeline, "load_config", lambda: make_cfg())

    assert pipeline.collect_only() == 0
    payload = json.loads(pool_path.read_text())
    assert payload["reader_profile"] == {"steer": None, "section_weights": {}}


# --- the Anthropic curator appends the steer as a second system block --------

class _Messages:
    def __init__(self, recorder):
        self._recorder = recorder

    def parse(self, **kwargs):
        self._recorder.append(kwargs)

        class _Resp:
            parsed_output = None
            stop_reason = "end_turn"

        return _Resp()


class _StubAnthropic:
    """Stands in for anthropic.Anthropic: records the call and returns no output,
    so curate() bails before any network or validation happens."""

    calls: list = []

    def __init__(self, *args, **kwargs):
        self.messages = _Messages(_StubAnthropic.calls)


def _curate_and_capture(monkeypatch, cfg):
    _StubAnthropic.calls = []
    monkeypatch.setattr(curator.anthropic, "Anthropic", _StubAnthropic)
    curator.curate(cfg, [{"url": "https://x.com/a"}], [])
    assert _StubAnthropic.calls, "curate() never reached the API call"
    return _StubAnthropic.calls[0]["system"]


def test_curator_sends_one_system_block_without_a_steer(monkeypatch):
    blocks = _curate_and_capture(monkeypatch, make_cfg())
    assert len(blocks) == 1
    assert blocks[0]["cache_control"] == {"type": "ephemeral"}


def test_curator_appends_an_uncached_second_system_block_with_a_steer(monkeypatch):
    blocks = _curate_and_capture(monkeypatch, make_cfg(STEER, {"tools": 1.3}))
    assert len(blocks) == 2
    # The big cached block must stay byte-identical, or the cache misses.
    assert blocks[0]["text"] == curate_schema.system_prompt(make_cfg())
    assert "cache_control" not in blocks[1]
    assert STEER in blocks[1]["text"]
    assert "tools ×1.3" in blocks[1]["text"]
