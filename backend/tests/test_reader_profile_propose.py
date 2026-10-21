"""Tests for the LLM half of the feedback loop — the proposal and its guard rails.

The model gets to name patterns in her reactions, but it is never trusted with
facts: every evidence URL it returns must already be one we gave it, every number
is clamped, and every unknown section id is thrown away.
"""

import json

import reader_profile
from reader_profile import Axis, ProposalOut, SectionWeight
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


def make_axis(name="Hands-on tools", urls=None, current=0.4, ideal=0.8):
    return Axis(
        name=name,
        definition="She prefers tools she can try over essays about strategy.",
        evidence_urls=urls if urls is not None else ["https://x.com/a"],
        current=current,
        ideal=ideal,
    )


def make_out(axes=None, weights=None, summary="A summary.", steer="A steer."):
    return ProposalOut(
        emergent_axes=axes if axes is not None else [make_axis()],
        profile_summary=summary,
        proposed_steer=steer,
        section_weights=weights
        if weights is not None
        else [SectionWeight(id="tools", weight=1.3)],
    )


def make_numbers():
    return {
        "generated_at": "2026-09-20T00:00:00+00:00",
        "half_life_days": 30.0,
        "counts": {"events": 3, "explicit": 3, "implicit": 0,
                   "issue_checkins": 0, "unmatched_urls": 0},
        "sections": {
            "tools": {"net": 2.0, "positive": 2.0, "n_explicit": 2, "n_implicit": 0,
                      "confidence": 0.22, "mix_current": 0.6, "mix_ideal": 0.9,
                      "direction": 0.3},
            "news": {"net": -1.0, "positive": 0.0, "n_explicit": 1, "n_implicit": 0,
                     "confidence": 0.12, "mix_current": 0.4, "mix_ideal": 0.1,
                     "direction": -0.3},
        },
        "chip_tallies": {"too_technical": {"loved": 0.0, "more": 0.0,
                                           "less": 1.0, "total": 1.0}},
        "top_positive": [{"url": "https://x.com/a", "headline": "H", "summary": "S",
                          "section": "tools", "source_name": "Src", "terms": [],
                          "score": 2.0, "chips": []}],
        "top_negative": [{"url": "https://x.com/b", "headline": "H2", "summary": "S2",
                          "section": "news", "source_name": "Src", "terms": [],
                          "score": -1.0, "chips": ["too_technical"]}],
    }


ALLOWED = ["https://x.com/a", "https://x.com/b"]
SECTION_IDS = ["tools", "news"]


# --- build_evidence -----------------------------------------------------------

def test_build_evidence_carries_the_lists_the_model_needs():
    evidence = reader_profile.build_evidence(make_cfg(), make_numbers())
    assert evidence["section_ids"] == ["tools", "news"]
    assert evidence["section_mix"]["tools"] == {"current": 0.6, "ideal": 0.9}
    assert [c["url"] for c in evidence["top_positive"]] == ["https://x.com/a"]
    assert [c["url"] for c in evidence["top_negative"]] == ["https://x.com/b"]
    assert evidence["relevance_focus"] == "f"
    assert "too_technical" in evidence["chip_tallies"]


# --- filter_proposal ----------------------------------------------------------

def test_filter_strips_urls_the_model_was_never_given():
    out = make_out([make_axis(urls=["https://x.com/a", "https://invented.test/x"])])
    result = reader_profile.filter_proposal(out, ALLOWED, SECTION_IDS)
    assert result["emergent_axes"][0]["evidence_urls"] == ["https://x.com/a"]


def test_filter_drops_an_axis_left_with_no_evidence():
    out = make_out([make_axis(urls=["https://invented.test/x"]), make_axis()])
    result = reader_profile.filter_proposal(out, ALLOWED, SECTION_IDS)
    assert len(result["emergent_axes"]) == 1


def test_filter_accepts_canonical_variants_but_stores_our_own_spelling():
    # The model may echo a url back with tracking noise or a "www."; the link we
    # publish in the report must be the one WE handed it, not its rewrite.
    out = make_out([make_axis(urls=["https://www.x.com/a/?utm_source=n"])])
    result = reader_profile.filter_proposal(out, ALLOWED, SECTION_IDS)
    assert result["emergent_axes"][0]["evidence_urls"] == ["https://x.com/a"]


def test_filter_drops_a_url_the_model_repeated():
    out = make_out([make_axis(urls=["https://x.com/a", "https://www.x.com/a/"])])
    result = reader_profile.filter_proposal(out, ALLOWED, SECTION_IDS)
    assert result["emergent_axes"][0]["evidence_urls"] == ["https://x.com/a"]


def test_filter_clamps_axis_positions_into_zero_to_one():
    out = make_out([make_axis(current=-3.0, ideal=9.0)])
    axis = reader_profile.filter_proposal(out, ALLOWED, SECTION_IDS)["emergent_axes"][0]
    assert axis["current"] == 0.0
    assert axis["ideal"] == 1.0


def test_filter_clamps_section_weights_and_drops_unknown_ids():
    out = make_out(
        weights=[
            SectionWeight(id="tools", weight=99.0),
            SectionWeight(id="news", weight=0.0),
            SectionWeight(id="made_up", weight=1.0),
        ]
    )
    weights = reader_profile.filter_proposal(out, ALLOWED, SECTION_IDS)["section_weights"]
    assert weights == {"tools": 3.0, "news": 0.25}


def test_filter_truncates_the_summary_and_the_steer_to_120_words():
    long = " ".join(f"w{i}" for i in range(300))
    result = reader_profile.filter_proposal(
        make_out(summary=long, steer=long), ALLOWED, SECTION_IDS
    )
    assert len(result["profile_summary"].split()) == 120
    assert len(result["proposed_steer"].split()) == 120


# --- propose ------------------------------------------------------------------

def test_claude_code_proposer_writes_the_evidence_file_and_returns_none(
    tmp_path, monkeypatch, capsys
):
    evidence_path = tmp_path / "profile_evidence.json"
    monkeypatch.setattr(reader_profile, "EVIDENCE_PATH", evidence_path)
    evidence = reader_profile.build_evidence(make_cfg(), make_numbers())

    assert reader_profile.propose(make_cfg(), evidence, "claude-code") is None
    written = json.loads(evidence_path.read_text())
    assert written["evidence"]["section_ids"] == ["tools", "news"]
    assert "output_schema" in written
    assert "--proposal" in capsys.readouterr().out


class _FakeInteraction:
    def __init__(self, text):
        self.output_text = text


def _valid_model_json():
    return json.dumps(
        {
            "emergent_axes": [
                {
                    "name": "Hands-on tools",
                    "definition": "She prefers things she can try.",
                    "evidence_urls": ["https://x.com/a", "https://invented.test/x"],
                    "current": 0.4,
                    "ideal": 0.9,
                }
            ],
            "profile_summary": "She wants tools.",
            "proposed_steer": "Favour hands-on tools.",
            "section_weights": [{"id": "tools", "weight": 1.4}],
        }
    )


def test_gemini_proposer_parses_and_filters_the_model_output(monkeypatch):
    monkeypatch.setattr(reader_profile, "_gemini_client", lambda: object())
    monkeypatch.setattr(
        reader_profile,
        "create_with_retry",
        lambda client, **kwargs: _FakeInteraction(_valid_model_json()),
    )
    evidence = reader_profile.build_evidence(make_cfg(), make_numbers())
    result = reader_profile.propose(make_cfg(), evidence, "gemini")
    assert result["proposed_steer"] == "Favour hands-on tools."
    assert result["section_weights"] == {"tools": 1.4}
    assert result["emergent_axes"][0]["evidence_urls"] == ["https://x.com/a"]


def test_gemini_proposer_returns_none_when_the_call_fails(monkeypatch):
    def boom(client, **kwargs):
        raise RuntimeError("server disconnected")

    monkeypatch.setattr(reader_profile, "_gemini_client", lambda: object())
    monkeypatch.setattr(reader_profile, "create_with_retry", boom)
    evidence = reader_profile.build_evidence(make_cfg(), make_numbers())
    assert reader_profile.propose(make_cfg(), evidence, "gemini") is None


def test_gemini_proposer_returns_none_on_unparseable_output(monkeypatch):
    monkeypatch.setattr(reader_profile, "_gemini_client", lambda: object())
    monkeypatch.setattr(
        reader_profile,
        "create_with_retry",
        lambda client, **kwargs: _FakeInteraction("not json at all"),
    )
    evidence = reader_profile.build_evidence(make_cfg(), make_numbers())
    assert reader_profile.propose(make_cfg(), evidence, "gemini") is None


def test_an_unknown_proposer_name_returns_none(monkeypatch):
    evidence = reader_profile.build_evidence(make_cfg(), make_numbers())
    assert reader_profile.propose(make_cfg(), evidence, "nonsense") is None


# --- ingest_proposal ----------------------------------------------------------

def test_ingest_proposal_reads_filters_and_returns_the_proposal(tmp_path):
    path = tmp_path / "profile_proposal.json"
    path.write_text(_valid_model_json())
    evidence = reader_profile.build_evidence(make_cfg(), make_numbers())
    result = reader_profile.ingest_proposal(make_cfg(), path, evidence)
    assert result["emergent_axes"][0]["evidence_urls"] == ["https://x.com/a"]
    assert result["section_weights"] == {"tools": 1.4}


def test_ingest_proposal_returns_none_for_a_broken_file(tmp_path):
    path = tmp_path / "profile_proposal.json"
    path.write_text("{ not json")
    evidence = reader_profile.build_evidence(make_cfg(), make_numbers())
    assert reader_profile.ingest_proposal(make_cfg(), path, evidence) is None


def test_ingest_proposal_returns_none_for_a_missing_file(tmp_path):
    evidence = reader_profile.build_evidence(make_cfg(), make_numbers())
    assert reader_profile.ingest_proposal(
        make_cfg(), tmp_path / "absent.json", evidence
    ) is None


def test_proposal_system_prompt_states_the_no_invented_urls_rule():
    prompt = reader_profile.PROPOSAL_SYSTEM
    assert "Never write a url that was not in the input." in prompt
    assert "Choose ONLY from" in prompt
