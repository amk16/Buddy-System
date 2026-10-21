"""Tests for what the feedback loop leaves on disk: the profile JSON, the pending
proposal, the local HTML report, and the accept step that makes a steer active.
"""

import json
from datetime import datetime, timezone

import yaml

import config as config_module
import reader_profile
from config import Config, SectionConfig, load_config

NOW = datetime(2026, 9, 20, tzinfo=timezone.utc)


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


def make_profile(**kw):
    profile = {
        "generated_at": "2026-09-20T00:00:00+00:00",
        "half_life_days": 30.0,
        "counts": {"events": 4, "explicit": 3, "implicit": 1,
                   "issue_checkins": 0, "unmatched_urls": 0},
        "sections": {
            "tools": {"label": "Tools", "net": 2.0, "positive": 2.0,
                      "n_explicit": 2, "n_implicit": 1, "confidence": 0.31,
                      "mix_current": 0.6, "mix_ideal": 0.9, "direction": 0.3},
            "case_studies": {"label": "Case Studies", "net": -1.0, "positive": 0.0,
                             "n_explicit": 1, "n_implicit": 0, "confidence": 0.12,
                             "mix_current": 0.4, "mix_ideal": 0.1,
                             "direction": -0.3},
        },
        "chip_tallies": {"too_technical": {"loved": 0.0, "more": 0.0,
                                           "less": 1.0, "total": 1.0}},
        "top_positive": [{"url": "https://x.com/a", "headline": "Loved one",
                          "summary": "S", "section": "tools", "source_name": "Src",
                          "terms": [], "score": 2.0, "chips": []}],
        "top_negative": [{"url": "https://x.com/b", "headline": "Less one",
                          "summary": "S2", "section": "case_studies", "source_name": "Src",
                          "terms": [], "score": -1.0, "chips": ["too_technical"]}],
        "emergent_axes": [],
        "proposal_pending": False,
    }
    profile.update(kw)
    return profile


def make_proposal(**kw):
    proposal = {
        "emergent_axes": [
            {
                "name": "Hands-on tools",
                "definition": "Things she can try beat essays about strategy.",
                "evidence_urls": ["https://x.com/a"],
                "current": 0.4,
                "ideal": 0.9,
            }
        ],
        "profile_summary": "She wants tools she can try.",
        "proposed_steer": "Favour hands-on tools she can run this week.",
        "section_weights": {"tools": 1.3, "news": 0.7},
    }
    proposal.update(kw)
    return proposal


# --- write_outputs ------------------------------------------------------------

def test_write_outputs_writes_profile_json_and_report_html(tmp_path):
    reader_profile.write_outputs(make_profile(), None, None, out_dir=tmp_path)
    assert json.loads((tmp_path / "profile.json").read_text())["half_life_days"] == 30.0
    assert (tmp_path / "report.html").read_text().startswith("<!doctype html>")


def test_write_outputs_skips_proposal_yaml_when_there_is_no_proposal(tmp_path):
    reader_profile.write_outputs(make_profile(), None, None, out_dir=tmp_path)
    assert not (tmp_path / "proposal.yaml").exists()


def test_write_outputs_writes_proposal_yaml_when_a_proposal_exists(tmp_path):
    profile = make_profile(proposal_pending=True)
    reader_profile.write_outputs(profile, make_proposal(), None, out_dir=tmp_path)
    data = yaml.safe_load((tmp_path / "proposal.yaml").read_text())
    assert data["proposed_steer"].startswith("Favour hands-on tools")
    assert data["section_weights"] == {"tools": 1.3, "news": 0.7}
    assert "accepted_at" not in data  # a fresh proposal is not stamped
    assert data["based_on"] == {"explicit": 3, "implicit": 1, "issues": 0}
    assert data["generated_at"] == "2026-09-20T00:00:00+00:00"
    assert "emergent_axes" in data


# --- render_report ------------------------------------------------------------

def test_render_report_escapes_html_in_the_data():
    profile = make_profile()
    profile["top_positive"][0]["headline"] = "<script>alert(1)</script>"
    html = reader_profile.render_report(profile, None, None)
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;" in html


def test_render_report_names_every_section_and_the_evidence_link():
    html = reader_profile.render_report(make_profile(), make_proposal(), None)
    assert "Tools" in html
    assert "Case Studies" in html
    assert 'href="https://x.com/a"' in html
    assert "Hands-on tools" in html
    assert "Reason tallies" in html
    assert "Section mix" in html


def test_render_report_says_none_in_both_steer_columns_when_there_is_neither():
    profile = make_profile(top_positive=[], top_negative=[], chip_tallies={},
                           emergent_axes=[])
    html = reader_profile.render_report(profile, None, None)
    assert "Pending proposal" in html
    assert "Active steer" in html
    # Exactly the two steer columns say "None." — the empty axes and empty card
    # lists say something else, so one wording can never stand in for another.
    assert html.count('<p class="muted">None.</p>') == 2
    assert "None proposed yet." in html
    assert "No reasons given yet." in html
    assert html.count("None yet.") == 2  # top loved + top less


def test_render_report_names_the_pending_proposals_generated_at():
    proposal = {**make_proposal(), "generated_at": "2026-09-20T00:00:00+00:00"}
    html = reader_profile.render_report(make_profile(), proposal, None)
    assert "Proposed 2026-09-20" in html
    assert "Accepted" not in html


def test_render_report_shows_an_accepted_proposal_as_accepted_not_pending():
    proposal = {
        **make_proposal(),
        "generated_at": "2026-09-20T00:00:00+00:00",
        "accepted_at": "2026-09-21T09:00:00+00:00",
    }
    html = reader_profile.render_report(make_profile(), proposal, None)
    assert "Accepted 2026-09-21" in html
    assert "Nothing new is waiting" in html


def test_render_report_uses_plain_font_family_names():
    # local(...) is only valid inside @font-face src; in font-family it makes the
    # browser drop the whole declaration.
    html = reader_profile.render_report(make_profile(), None, None)
    assert "local(" not in html
    assert 'font-family: "Fraunces", "Iowan Old Style", Georgia, serif;' in html
    assert 'font-family: "Source Sans 3", ui-sans-serif, system-ui, sans-serif;' in html


def test_render_report_uses_the_section_label_not_the_raw_id():
    html = reader_profile.render_report(make_profile(), None, None)
    assert ">Case Studies<" in html
    assert ">case_studies<" not in html


def test_render_report_tints_the_current_and_ideal_bars_apart():
    html = reader_profile.render_report(make_profile(), None, None)
    assert "--border-strong: #d8cfba" in html
    assert "background: var(--border-strong)" in html
    assert "background: var(--accent)" in html


def test_the_renderer_lives_in_its_own_module():
    import reader_profile_report

    assert reader_profile.render_report is reader_profile_report.render_report


def test_render_report_shows_the_active_steer():
    active = {"steer": "The active steer text.", "section_weights": {"tools": 1.3}}
    html = reader_profile.render_report(make_profile(), None, active)
    assert "The active steer text." in html


def test_render_report_header_explains_the_two_different_counts():
    html = reader_profile.render_report(make_profile(), None, None)
    assert "reactions after undo" in html
    assert "include issue check-ins" in html


def test_render_report_loads_no_external_resources():
    html = reader_profile.render_report(make_profile(), make_proposal(), None)
    assert "<script" not in html.lower()
    assert "fonts.googleapis" not in html
    assert "<link" not in html.lower()


# --- the proposal lifecycle ---------------------------------------------------

def write_proposal_file(tmp_path, **extra):
    path = tmp_path / "proposal.yaml"
    path.write_text(
        yaml.safe_dump(
            {
                **make_proposal(),
                "generated_at": "2026-09-20T00:00:00+00:00",
                "based_on": {"explicit": 3, "implicit": 1, "issues": 0},
                **extra,
            },
            allow_unicode=True,
            sort_keys=False,
        )
    )
    return path


def test_accept_steer_stamps_the_proposal_with_an_accepted_at(tmp_path):
    proposal_path = write_proposal_file(tmp_path)
    assert reader_profile.accept_steer(proposal_path, tmp_path / "steer.yaml",
                                       issues_dir=tmp_path / "issues") == 0
    stamped = yaml.safe_load(proposal_path.read_text())
    assert stamped["accepted_at"]
    # The rest of the proposal survives the stamp.
    assert stamped["proposed_steer"].startswith("Favour hands-on tools")
    assert stamped["generated_at"] == "2026-09-20T00:00:00+00:00"


def test_accept_steer_refuses_an_already_accepted_proposal(tmp_path, capsys):
    proposal_path = write_proposal_file(tmp_path,
                                        accepted_at="2026-09-21T09:00:00+00:00")
    steer_path = tmp_path / "steer.yaml"
    assert reader_profile.accept_steer(proposal_path, steer_path,
                                       issues_dir=tmp_path / "issues") == 1
    assert not steer_path.exists()
    out = capsys.readouterr().out
    assert "already accepted" in out.lower()
    assert "2026-09-21" in out


def test_accept_steer_prints_when_the_proposal_was_generated(tmp_path, capsys):
    reader_profile.accept_steer(write_proposal_file(tmp_path),
                                tmp_path / "steer.yaml",
                                issues_dir=tmp_path / "issues")
    assert "2026-09-20" in capsys.readouterr().out


def test_accept_steer_warns_when_the_proposal_predates_the_newest_issue(tmp_path,
                                                                        capsys):
    issues = tmp_path / "issues"
    issues.mkdir()
    (issues / "2026-09-25.json").write_text(
        json.dumps({"id": "2026-09-25", "generated_at": "2026-09-25T00:00:00+00:00",
                    "sections": []})
    )
    reader_profile.accept_steer(write_proposal_file(tmp_path),
                                tmp_path / "steer.yaml", issues_dir=issues)
    out = capsys.readouterr().out
    assert "predates" in out.lower()
    assert "2026-09-25" in out


def test_accept_steer_does_not_warn_when_the_proposal_is_newer(tmp_path, capsys):
    issues = tmp_path / "issues"
    issues.mkdir()
    (issues / "2026-09-10.json").write_text(
        json.dumps({"id": "2026-09-10", "generated_at": "2026-09-10T00:00:00+00:00",
                    "sections": []})
    )
    reader_profile.accept_steer(write_proposal_file(tmp_path),
                                tmp_path / "steer.yaml", issues_dir=issues)
    assert "predates" not in capsys.readouterr().out.lower()


def test_proposal_pending_is_false_once_the_proposal_is_stamped(tmp_path):
    write_proposal_file(tmp_path, accepted_at="2026-09-21T09:00:00+00:00")
    profile = make_profile()
    reader_profile.write_outputs(profile, None, None, out_dir=tmp_path)
    assert profile["proposal_pending"] is False
    assert json.loads((tmp_path / "profile.json").read_text())[
        "proposal_pending"] is False


def test_proposal_pending_is_true_while_an_unstamped_proposal_sits_on_disk(tmp_path):
    write_proposal_file(tmp_path)
    profile = make_profile()
    reader_profile.write_outputs(profile, None, None, out_dir=tmp_path)
    assert profile["proposal_pending"] is True


def test_profile_json_takes_its_axes_from_the_proposal_on_disk(tmp_path):
    # No fresh proposal this run, so the report shows the proposal already on
    # disk. profile.json has to show the same axes or the two outputs disagree.
    write_proposal_file(tmp_path)
    profile = make_profile(emergent_axes=[])
    reader_profile.write_outputs(profile, None, None, out_dir=tmp_path)
    written = json.loads((tmp_path / "profile.json").read_text())
    assert [axis["name"] for axis in written["emergent_axes"]] == ["Hands-on tools"]
    assert [axis["name"] for axis in profile["emergent_axes"]] == ["Hands-on tools"]


def test_profile_json_has_no_axes_when_nothing_is_on_disk(tmp_path):
    profile = make_profile(emergent_axes=[])
    reader_profile.write_outputs(profile, None, None, out_dir=tmp_path)
    assert json.loads((tmp_path / "profile.json").read_text())["emergent_axes"] == []


def test_write_outputs_leaves_an_existing_proposal_alone_when_none_is_made(tmp_path):
    path = write_proposal_file(tmp_path, accepted_at="2026-09-21T09:00:00+00:00")
    before = path.read_text()
    reader_profile.write_outputs(make_profile(), None, None, out_dir=tmp_path)
    assert path.read_text() == before


def test_a_fresh_proposal_replaces_a_stamped_one_and_is_pending_again(tmp_path):
    path = write_proposal_file(tmp_path, accepted_at="2026-09-21T09:00:00+00:00")
    profile = make_profile()
    reader_profile.write_outputs(profile, make_proposal(), None, out_dir=tmp_path)
    rewritten = yaml.safe_load(path.read_text())
    assert "accepted_at" not in rewritten
    assert profile["proposal_pending"] is True


def test_the_report_shows_a_stamped_proposal_left_on_disk_as_accepted(tmp_path):
    write_proposal_file(tmp_path, accepted_at="2026-09-21T09:00:00+00:00")
    reader_profile.write_outputs(make_profile(), None, None, out_dir=tmp_path)
    assert "Accepted 2026-09-21" in (tmp_path / "report.html").read_text()


# --- accept_steer -------------------------------------------------------------

def test_accept_steer_writes_a_steer_file_that_load_config_merges(tmp_path):
    proposal_path = tmp_path / "proposal.yaml"
    proposal_path.write_text(
        yaml.safe_dump(
            {
                **make_proposal(),
                "generated_at": "2026-09-20T00:00:00+00:00",
                "based_on": {"explicit": 3, "implicit": 1, "issues": 0},
            },
            allow_unicode=True,
        )
    )
    steer_path = tmp_path / "steer.yaml"
    assert reader_profile.accept_steer(proposal_path, steer_path,
                                       issues_dir=tmp_path / "issues") == 0

    written = yaml.safe_load(steer_path.read_text())
    assert written["steer"].startswith("Favour hands-on tools")
    assert "accepted_at" in written

    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(
        "title: T\nrelevance_focus: f\nsections:\n"
        "  - id: tools\n    label: Tools\n    max_items: 5\n"
        "  - id: news\n    label: News\n    max_items: 5\n"
    )
    cfg = load_config(cfg_path, steer_path=steer_path)
    assert cfg.steer.startswith("Favour hands-on tools")
    assert cfg.section_weights == {"tools": 1.3, "news": 0.7}


def test_accept_steer_returns_one_when_no_proposal_is_pending(tmp_path, capsys):
    assert reader_profile.accept_steer(tmp_path / "absent.yaml",
                                       tmp_path / "steer.yaml",
                                       issues_dir=tmp_path / "issues") == 1
    assert "no" in capsys.readouterr().out.lower()


def test_accept_steer_defaults_point_at_the_real_project_paths():
    import inspect

    defaults = inspect.signature(reader_profile.accept_steer).parameters
    assert defaults["proposal_path"].default == reader_profile.PROFILE_DIR / "proposal.yaml"
    assert defaults["steer_path"].default == config_module.STEER_PATH


# --- load_active_steer --------------------------------------------------------

def test_load_active_steer_returns_none_when_the_file_is_absent(tmp_path):
    assert reader_profile.load_active_steer(tmp_path / "absent.yaml") is None


def test_load_active_steer_returns_the_parsed_file(tmp_path):
    path = tmp_path / "steer.yaml"
    path.write_text("steer: Favour tools.\nsection_weights:\n  tools: 1.3\n")
    assert reader_profile.load_active_steer(path)["steer"] == "Favour tools."


# --- generate -----------------------------------------------------------------

def _stub_index():
    item = {
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
    index = {"https://x.com/a": {"issue_id": "2026-09-19", "section": "tools",
                                 "item": item}}
    issues = [
        {
            "id": "2026-09-19",
            "generated_at": "2026-09-19T00:00:00+00:00",
            "sections": [
                {"id": "tools", "items": [item]},
                {"id": "news", "items": []},
            ],
        }
    ]
    return index, issues


def _events(n):
    return [
        {
            "v": 1,
            "id": f"e{i}",
            "ts": "2026-09-20T00:00:00.000Z",
            "client_id": f"c{i}",
            "issue_id": "2026-09-19",
            "engine": "gemini",
            "url": "https://x.com/a",
            "kind": "more",
        }
        for i in range(n)
    ]


def _wire(monkeypatch, events):
    monkeypatch.setattr(reader_profile, "load_feedback", lambda **kw: events)
    monkeypatch.setattr(reader_profile, "build_item_index", lambda *a, **kw: _stub_index())
    calls = []
    monkeypatch.setattr(
        reader_profile,
        "propose",
        lambda cfg, evidence, proposer: calls.append(proposer) or None,
    )
    return calls


def test_generate_skips_the_llm_below_the_explicit_floor(tmp_path, monkeypatch):
    calls = _wire(monkeypatch, _events(2))
    profile = reader_profile.generate(
        make_cfg(feedback_min_explicit_for_proposal=10),
        proposer="gemini",
        now=NOW,
        out_dir=tmp_path,
    )
    assert calls == []
    assert profile["proposal_pending"] is False
    assert (tmp_path / "profile.json").exists()


def test_generate_calls_the_llm_at_the_explicit_floor(tmp_path, monkeypatch):
    calls = _wire(monkeypatch, _events(3))
    reader_profile.generate(
        make_cfg(feedback_min_explicit_for_proposal=3),
        proposer="gemini",
        now=NOW,
        out_dir=tmp_path,
    )
    assert calls == ["gemini"]


def test_generate_prefers_a_proposal_file_over_calling_the_llm(tmp_path, monkeypatch):
    calls = _wire(monkeypatch, _events(3))
    proposal_file = tmp_path / "profile_proposal.json"
    proposal_file.write_text(
        json.dumps(
            {
                "emergent_axes": [
                    {
                        "name": "Hands-on tools",
                        "definition": "Tools beat essays.",
                        "evidence_urls": ["https://x.com/a"],
                        "current": 0.4,
                        "ideal": 0.9,
                    }
                ],
                "profile_summary": "Summary.",
                "proposed_steer": "Steer.",
                "section_weights": [{"id": "tools", "weight": 1.3}],
            }
        )
    )
    profile = reader_profile.generate(
        make_cfg(feedback_min_explicit_for_proposal=3),
        proposer="claude-code",
        proposal_path=proposal_file,
        now=NOW,
        out_dir=tmp_path,
    )
    assert calls == []
    assert profile["proposal_pending"] is True
    assert profile["emergent_axes"][0]["name"] == "Hands-on tools"
    assert (tmp_path / "proposal.yaml").exists()
