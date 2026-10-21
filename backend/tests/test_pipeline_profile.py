"""Tests for the pipeline's side of the feedback loop.

The one rule that matters here: nothing in the feedback loop may ever stop an
issue from being published.
"""

import pipeline
import reader_profile
from config import Config, SectionConfig


def make_cfg(**kw):
    defaults = dict(
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
    )
    defaults.update(kw)
    return Config(**defaults)


def make_body():
    return {
        "brief": [],
        "sections": [
            {
                "id": "tools",
                "label": "Tools",
                "items": [
                    {
                        "section": "tools",
                        "headline": "H",
                        "summary": "S",
                        "why_it_matters": "W",
                        "terms": [],
                        "url": "https://x.com/a",
                        "source_name": "Src",
                        "signal_tag": "new",
                        "published_at": "2026-09-19",
                    }
                ],
            }
        ],
    }


def _stub_publish(tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline.store, "next_issue_id", lambda d: "2026-09-22")
    monkeypatch.setattr(
        pipeline.store, "write_issue", lambda issue: tmp_path / "2026-09-22.json"
    )
    monkeypatch.setattr(pipeline, "notify", lambda issue: None)


def test_persist_still_succeeds_when_profile_generation_raises(tmp_path, monkeypatch):
    _stub_publish(tmp_path, monkeypatch)

    def boom(*args, **kwargs):
        raise RuntimeError("feedback branch is on fire")

    monkeypatch.setattr(reader_profile, "generate", boom)
    assert pipeline._persist(make_cfg(), make_body()) == 0


def test_persist_reports_the_skipped_profile_without_failing(tmp_path, monkeypatch,
                                                             capsys):
    _stub_publish(tmp_path, monkeypatch)

    def boom(*args, **kwargs):
        raise RuntimeError("feedback branch is on fire")

    monkeypatch.setattr(reader_profile, "generate", boom)
    pipeline._persist(make_cfg(), make_body())
    assert "[profile] skipped" in capsys.readouterr().out


def test_persist_passes_the_engines_proposer_through(tmp_path, monkeypatch):
    _stub_publish(tmp_path, monkeypatch)
    seen = {}
    monkeypatch.setattr(
        reader_profile,
        "generate",
        lambda cfg, **kw: seen.update(kw) or {},
    )
    assert pipeline._persist(make_cfg(), make_body(), engine="gemini",
                             proposer="gemini") == 0
    assert seen["proposer"] == "gemini"


def test_persist_defaults_to_the_claude_code_proposer(tmp_path, monkeypatch):
    _stub_publish(tmp_path, monkeypatch)
    seen = {}
    monkeypatch.setattr(
        reader_profile,
        "generate",
        lambda cfg, **kw: seen.update(kw) or {},
    )
    pipeline._persist(make_cfg(), make_body())
    assert seen["proposer"] == "claude-code"


def test_maybe_profile_never_raises(monkeypatch):
    def boom(*args, **kwargs):
        raise ValueError("nope")

    monkeypatch.setattr(reader_profile, "generate", boom)
    pipeline._maybe_profile(make_cfg(), "gemini")  # must not raise


# --- CLI flag parsing ---------------------------------------------------------

def test_flag_value_reads_the_token_after_the_flag():
    assert pipeline._flag_value(["--profile", "--proposer", "gemini"],
                                "--proposer") == "gemini"


def test_flag_value_is_none_when_the_flag_is_absent():
    assert pipeline._flag_value(["--profile"], "--proposer") is None


def test_flag_value_is_none_when_the_flag_ends_the_arguments():
    assert pipeline._flag_value(["--profile", "--proposer"], "--proposer") is None


def test_flag_value_does_not_swallow_the_next_flag():
    # `--profile --feedback-dir --proposer gemini` is a typo, not a directory
    # literally named "--proposer".
    args = ["--profile", "--feedback-dir", "--proposer", "gemini"]
    assert pipeline._flag_value(args, "--feedback-dir") is None
