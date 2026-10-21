"""Tests for the deterministic half of the reader-feedback loop.

Every number in the profile is computed here, with no LLM involved, so the whole
thing stays explainable: a reaction's weight, how fast it fades, what "undo"
takes back, and how the section mix she gets compares with the one her reactions
ask for.
"""

import json
import math
import subprocess
from datetime import datetime, timedelta, timezone

import reader_profile
from config import Config, SectionConfig
from pathlib import Path

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


def make_event(kind, url, ts="2026-09-20T00:00:00.000Z", client="c1", **kw):
    event = {
        "v": 1,
        "id": f"{client}-{kind}-{url}-{ts}",
        "ts": ts,
        "client_id": client,
        "issue_id": "2026-09-20",
        "engine": "gemini",
        "url": url,
        "kind": kind,
    }
    event.update(kw)
    return event


def make_issue(issues_dir, issue_id, urls_by_section, generated_at=None):
    """Write a real issue JSON file, the same shape store.write_issue produces."""
    issues_dir.mkdir(parents=True, exist_ok=True)
    sections = [
        {
            "id": sid,
            "label": sid.title(),
            "items": [
                {
                    "section": sid,
                    "headline": f"Headline {url}",
                    "summary": "A grounded summary.",
                    "why_it_matters": "Try it with a client.",
                    "terms": [],
                    "url": url,
                    "source_name": "Source",
                    "signal_tag": "new",
                    "published_at": "2026-09-19",
                }
                for url in urls
            ],
        }
        for sid, urls in urls_by_section.items()
    ]
    issue = {
        "id": issue_id,
        "generated_at": generated_at or f"{issue_id}T00:00:00+00:00",
        "title": "T",
        "engine": "gemini",
        "brief": [],
        "sections": sections,
    }
    (issues_dir / f"{issue_id}.json").write_text(json.dumps(issue))
    return issue


def index_and_issues(issues_dir):
    return reader_profile.build_item_index(issues_dir)


def scored(cfg, events, issues_dir, now=NOW):
    index, issues = index_and_issues(issues_dir)
    resolved = reader_profile.resolve_reactions(events)
    return reader_profile.score(cfg, resolved, index, issues, now)


# --- decay --------------------------------------------------------------------

def test_decay_is_one_at_age_zero():
    assert reader_profile.decay("2026-09-20T00:00:00Z", NOW, 30.0) == 1.0


def test_decay_is_one_half_after_one_half_life():
    ts = (NOW - timedelta(days=30)).isoformat()
    assert reader_profile.decay(ts, NOW, 30.0) == 0.5


def test_decay_of_a_future_timestamp_is_one():
    ts = (NOW + timedelta(days=5)).isoformat()
    assert reader_profile.decay(ts, NOW, 30.0) == 1.0


def test_decay_of_an_unparseable_timestamp_is_zero():
    assert reader_profile.decay("not-a-date", NOW, 30.0) == 0.0


# --- resolve_reactions --------------------------------------------------------

def test_undo_removes_only_the_matching_clients_prior_explicit_reaction():
    url = "https://x.com/a"
    events = [
        make_event("more", url, ts="2026-09-18T00:00:00Z", client="c1"),
        make_event("more", url, ts="2026-09-18T01:00:00Z", client="c2"),
        make_event("undo", url, ts="2026-09-19T00:00:00Z", client="c1"),
    ]
    kept = reader_profile.resolve_reactions(events)
    assert [(e["kind"], e["client_id"]) for e in kept] == [("more", "c2")]


def test_a_loved_reaction_after_an_undo_still_counts():
    url = "https://x.com/a"
    events = [
        make_event("more", url, ts="2026-09-18T00:00:00Z"),
        make_event("undo", url, ts="2026-09-19T00:00:00Z"),
        make_event("loved", url, ts="2026-09-19T05:00:00Z"),
    ]
    kept = reader_profile.resolve_reactions(events)
    assert [e["kind"] for e in kept] == ["loved"]


def test_undo_matches_across_canonical_url_variants():
    events = [
        make_event("less", "https://www.x.com/a/", ts="2026-09-18T00:00:00Z"),
        make_event("undo", "https://x.com/a?utm_source=n", ts="2026-09-19T00:00:00Z"),
    ]
    assert reader_profile.resolve_reactions(events) == []


def test_implicit_events_are_deduped_per_client_url_and_kind():
    url = "https://x.com/a"
    events = [
        make_event("open", url, ts="2026-09-18T00:00:00Z"),
        make_event("open", url, ts="2026-09-19T00:00:00Z"),
        make_event("click", url, ts="2026-09-19T00:00:00Z"),
        make_event("open", url, ts="2026-09-19T00:00:00Z", client="c2"),
    ]
    kept = reader_profile.resolve_reactions(events)
    assert len(kept) == 3
    opens = [e for e in kept if e["kind"] == "open" and e["client_id"] == "c1"]
    assert [e["ts"] for e in opens] == ["2026-09-19T00:00:00Z"]


# --- score --------------------------------------------------------------------

def test_canonical_url_variants_all_hit_the_same_stored_item(tmp_path):
    make_issue(tmp_path, "2026-09-19", {"tools": ["https://x.com/a"]})
    events = [
        make_event("more", "https://www.x.com/a", client="c1"),
        make_event("more", "https://x.com/a/", client="c2"),
        make_event("more", "https://x.com/a?utm_medium=mail", client="c3"),
    ]
    out = scored(make_cfg(), events, tmp_path)
    assert out["counts"]["unmatched_urls"] == 0
    assert out["sections"]["tools"]["n_explicit"] == 3
    assert out["sections"]["tools"]["net"] == 3.0


def test_reactions_to_unknown_urls_are_counted_and_skipped(tmp_path):
    make_issue(tmp_path, "2026-09-19", {"tools": ["https://x.com/a"]})
    events = [make_event("loved", "https://elsewhere.test/gone")]
    out = scored(make_cfg(), events, tmp_path)
    assert out["counts"]["unmatched_urls"] == 1
    assert out["sections"]["tools"]["net"] == 0.0


def test_weights_are_applied_and_decayed(tmp_path):
    make_issue(tmp_path, "2026-09-19", {"tools": ["https://x.com/a"]})
    old = (NOW - timedelta(days=30)).isoformat()
    events = [make_event("loved", "https://x.com/a", ts=old)]
    out = scored(make_cfg(), events, tmp_path)
    assert out["sections"]["tools"]["net"] == 1.0  # 2.0 loved x 0.5 decay
    assert out["sections"]["tools"]["positive"] == 1.0


def test_mix_current_sums_to_one_and_direction_is_ideal_minus_current(tmp_path):
    # A 2/3 vs 1/3 split on purpose: those shares do not round cleanly, so a
    # direction computed from UNrounded numbers would disagree with the rounded
    # mix_ideal / mix_current actually stored next to it.
    # Tools gets two thirds of the items but only one third of the positive
    # reactions, so current and ideal are 0.6667 and 0.3333 — a pair whose
    # rounded difference (-0.3334) differs from the rounded raw difference
    # (-0.3333). Only a direction computed from the ROUNDED numbers agrees with
    # the two numbers stored beside it.
    make_issue(
        tmp_path,
        "2026-09-19",
        {"tools": ["https://x.com/t1", "https://x.com/t2"],
         "news": ["https://x.com/n1"]},
    )
    events = [
        make_event("more", "https://x.com/t1", client="c0"),
        make_event("more", "https://x.com/n1", client="c1"),
        make_event("more", "https://x.com/n1", client="c2"),
    ]
    out = scored(make_cfg(feedback_min_explicit_for_proposal=3), events, tmp_path)
    mix = [out["sections"][sid]["mix_current"] for sid in ("tools", "news")]
    assert math.isclose(sum(mix), 1.0, abs_tol=1e-4)
    assert out["sections"]["tools"]["mix_current"] == 0.6667
    assert out["sections"]["tools"]["mix_ideal"] == 0.3333
    assert out["sections"]["tools"]["direction"] == -0.3334
    for sid in ("tools", "news"):
        sec = out["sections"][sid]
        # The three stored numbers must agree with each other exactly.
        assert sec["direction"] == round(sec["mix_ideal"] - sec["mix_current"], 4)


def test_ideal_mix_falls_back_to_current_below_the_explicit_floor(tmp_path):
    make_issue(
        tmp_path,
        "2026-09-19",
        {"tools": ["https://x.com/t1"], "news": ["https://x.com/n1"]},
    )
    events = [make_event("loved", "https://x.com/t1")]
    out = scored(make_cfg(feedback_min_explicit_for_proposal=10), events, tmp_path)
    for sid in ("tools", "news"):
        sec = out["sections"][sid]
        assert sec["mix_ideal"] == sec["mix_current"]
        assert sec["direction"] == 0.0


def test_ideal_mix_follows_positive_mass_at_or_above_the_floor(tmp_path):
    make_issue(
        tmp_path,
        "2026-09-19",
        {"tools": ["https://x.com/t1"], "news": ["https://x.com/n1"]},
    )
    events = [
        make_event("more", "https://x.com/t1", client=f"c{i}") for i in range(2)
    ]
    out = scored(make_cfg(feedback_min_explicit_for_proposal=2), events, tmp_path)
    assert out["sections"]["tools"]["mix_ideal"] == 1.0
    assert out["sections"]["news"]["mix_ideal"] == 0.0
    assert math.isclose(out["sections"]["tools"]["direction"], 0.5)


def test_confidence_is_zero_with_no_reactions_and_about_two_thirds_at_eight(tmp_path):
    urls = [f"https://x.com/t{i}" for i in range(8)]
    make_issue(tmp_path, "2026-09-19", {"tools": urls})
    empty = scored(make_cfg(), [], tmp_path)
    assert empty["sections"]["tools"]["confidence"] == 0.0

    events = [make_event("open", url) for url in urls]
    out = scored(make_cfg(), events, tmp_path)
    # Stored numbers are rounded to 4 decimals so the JSON stays readable.
    assert math.isclose(out["sections"]["tools"]["confidence"], 1 - math.exp(-1),
                        abs_tol=1e-4)


def test_chip_tallies_are_decayed_and_split_by_kind(tmp_path):
    make_issue(
        tmp_path,
        "2026-09-19",
        {"tools": ["https://x.com/a"], "news": ["https://x.com/b"]},
    )
    old = (NOW - timedelta(days=30)).isoformat()
    events = [
        make_event("less", "https://x.com/a", reasons=["too_technical"]),
        make_event("less", "https://x.com/b", ts=old, reasons=["too_technical"],
                   client="c2"),
        make_event("loved", "https://x.com/a", reasons=["too_technical"], client="c3"),
    ]
    out = scored(make_cfg(), events, tmp_path)
    tally = out["chip_tallies"]["too_technical"]
    assert math.isclose(tally["less"], 1.5)  # 1.0 fresh + 0.5 one half-life old
    assert math.isclose(tally["loved"], 1.0)
    assert math.isclose(tally["total"], 2.5)


def test_issue_checkin_spreads_evenly_over_the_issues_sections(tmp_path):
    make_issue(
        tmp_path,
        "2026-09-19",
        {"tools": ["https://x.com/a"], "news": ["https://x.com/b"]},
    )
    events = [
        make_event("issue", "", issue_id="2026-09-19", value="useful", section=None)
    ]
    out = scored(make_cfg(), events, tmp_path)
    assert out["counts"]["issue_checkins"] == 1
    assert out["counts"]["unmatched_urls"] == 0
    for sid in ("tools", "news"):
        assert math.isclose(out["sections"][sid]["net"], 0.5)
        assert out["sections"][sid]["n_explicit"] == 1


def test_top_positive_and_negative_carry_card_content(tmp_path):
    make_issue(
        tmp_path,
        "2026-09-19",
        {"tools": ["https://x.com/good"], "news": ["https://x.com/bad"]},
    )
    events = [
        make_event("loved", "https://x.com/good", reasons=["hands_on"]),
        make_event("less", "https://x.com/bad", reasons=["too_technical"]),
    ]
    out = scored(make_cfg(), events, tmp_path)
    assert [e["url"] for e in out["top_positive"]] == ["https://x.com/good"]
    assert out["top_positive"][0]["headline"] == "Headline https://x.com/good"
    assert out["top_positive"][0]["section"] == "tools"
    assert out["top_positive"][0]["chips"] == ["hands_on"]
    assert [e["url"] for e in out["top_negative"]] == ["https://x.com/bad"]


def test_top_lists_are_capped_at_top_k(tmp_path):
    urls = [f"https://x.com/t{i}" for i in range(5)]
    make_issue(tmp_path, "2026-09-19", {"tools": urls})
    events = [make_event("more", url) for url in urls]
    out = scored(make_cfg(feedback_top_k=2), events, tmp_path)
    assert len(out["top_positive"]) == 2


def test_sections_carry_a_display_label_with_the_emoji_stripped(tmp_path):
    make_issue(tmp_path, "2026-09-19", {"tools": ["https://x.com/a"]})
    cfg = make_cfg(
        sections=[
            SectionConfig(id="tools", label="\U0001f6e0 Tools", max_items=5),
            SectionConfig(id="case_studies", label="\U0001f4c8 Case Studies",
                          max_items=5),
        ]
    )
    out = scored(cfg, [], tmp_path)
    assert out["sections"]["tools"]["label"] == "Tools"
    assert out["sections"]["case_studies"]["label"] == "Case Studies"


def test_section_label_falls_back_to_the_id_when_the_label_is_only_an_emoji(tmp_path):
    make_issue(tmp_path, "2026-09-19", {"tools": ["https://x.com/a"]})
    cfg = make_cfg(sections=[SectionConfig(id="tools", label="\U0001f6e0",
                                           max_items=5)])
    assert scored(cfg, [], tmp_path)["sections"]["tools"]["label"] == "tools"


def test_sections_from_config_are_always_present(tmp_path):
    make_issue(tmp_path, "2026-09-19", {"tools": ["https://x.com/a"]})
    out = scored(make_cfg(), [], tmp_path)
    assert set(out["sections"]) == {"tools", "news"}


# --- build_item_index ---------------------------------------------------------

def test_item_index_prefers_the_newest_issue_and_skips_the_index_file(tmp_path):
    make_issue(tmp_path, "2026-09-18", {"news": ["https://x.com/a"]})
    make_issue(tmp_path, "2026-09-19", {"tools": ["https://x.com/a"]})
    (tmp_path / "index.json").write_text("[]")
    (tmp_path / "broken.json").write_text("{not json")
    index, issues = reader_profile.build_item_index(tmp_path)
    assert index["https://x.com/a"]["issue_id"] == "2026-09-19"
    assert index["https://x.com/a"]["section"] == "tools"
    assert [i["id"] for i in issues] == ["2026-09-19", "2026-09-18"]


# --- load_feedback ------------------------------------------------------------

def test_load_feedback_reads_jsonl_from_a_directory_and_skips_bad_lines(tmp_path):
    (tmp_path / "2026-09.jsonl").write_text(
        json.dumps(make_event("more", "https://x.com/a"))
        + "\n{ broken\n\n"
        + json.dumps(make_event("less", "https://x.com/b"))
        + "\n"
    )
    events = reader_profile.load_feedback(feedback_dir=tmp_path)
    assert [e["kind"] for e in events] == ["more", "less"]


def test_load_feedback_returns_empty_for_a_missing_git_ref(tmp_path):
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    assert reader_profile.load_feedback(ref="origin/feedback", repo_root=tmp_path) == []


def test_a_missing_feedback_ref_says_so_and_names_the_fetch(tmp_path, capsys):
    # Silence here used to read as "she has not reacted to anything"; the ref
    # simply was not fetched, and the line says which command fixes it.
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    assert reader_profile.load_feedback(ref="origin/feedback", repo_root=tmp_path) == []
    out = capsys.readouterr().out
    assert "no feedback ref origin/feedback" in out
    assert "git fetch origin feedback" in out


def test_load_feedback_on_a_missing_directory_returns_empty(tmp_path):
    assert reader_profile.load_feedback(feedback_dir=tmp_path / "nope") == []


def test_load_feedback_returns_empty_when_there_is_no_git_repo_at_all(tmp_path):
    # No `git init` here: the command fails, and that is a normal state, not a crash.
    assert reader_profile.load_feedback(ref="origin/feedback", repo_root=tmp_path) == []


def _commit_feedback_branch(repo: Path, payload: bytes) -> None:
    """Build a throwaway repo with one feedback file on a `feedback` branch."""
    run = lambda *args: subprocess.run(args, cwd=repo, check=True,
                                       capture_output=True)
    run("git", "init", "-q", "-b", "feedback")
    run("git", "config", "user.email", "t@example.com")
    run("git", "config", "user.name", "T")
    (repo / "feedback").mkdir()
    (repo / "feedback" / "2026-09.jsonl").write_bytes(payload)
    run("git", "add", "-A")
    run("git", "commit", "-qm", "feedback")


def test_load_feedback_reads_jsonl_from_a_git_ref(tmp_path):
    line = json.dumps(make_event("more", "https://x.com/a")).encode()
    _commit_feedback_branch(tmp_path, line + b"\n")
    events = reader_profile.load_feedback(ref="feedback", repo_root=tmp_path)
    assert [e["kind"] for e in events] == ["more"]


def test_load_feedback_survives_invalid_utf8_bytes_on_the_branch(tmp_path):
    good = json.dumps(make_event("more", "https://x.com/a")).encode()
    # A raw 0xff byte is not valid UTF-8 — decoding must not raise.
    _commit_feedback_branch(tmp_path, good + b"\n{\xff\xfe bad bytes}\n")
    events = reader_profile.load_feedback(ref="feedback", repo_root=tmp_path)
    assert [e["kind"] for e in events] == ["more"]
