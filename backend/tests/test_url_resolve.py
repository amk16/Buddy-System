"""Unit tests for url_resolve + the grounding-citation filter — all network-free.

These cover the two correctness-critical, pure pieces of the Gemini engine:
URL canonicalization (used for dedupe + citation matching) and the anti-
hallucination rule that only grounding-backed URLs survive.
"""

import collectors.web_gemini as wg
from url_resolve import canonicalize, is_redirect


# --- canonicalize ------------------------------------------------------------

def test_strips_utm_and_tracking_params():
    assert canonicalize(
        "https://ex.com/post?utm_source=rss&utm_medium=email&id=7"
    ) == "https://ex.com/post?id=7"
    assert canonicalize("https://ex.com/p?gclid=abc&fbclid=xyz") == "https://ex.com/p"


def test_strips_www_trailing_slash_and_fragment():
    assert canonicalize("https://www.ex.com/path/") == "https://ex.com/path"
    assert canonicalize("https://EX.com/Path#section") == "https://ex.com/Path"


def test_scheme_and_host_lowercased_path_preserved():
    # Host case is irrelevant; path case can be significant, so keep it.
    assert canonicalize("HTTPS://Ex.Com/AbC") == "https://ex.com/AbC"


def test_idempotent():
    once = canonicalize("https://www.ex.com/a/?utm_source=x&ref=y")
    assert canonicalize(once) == once


def test_passthrough_non_http():
    assert canonicalize("mailto:a@b.com") == "mailto:a@b.com"
    assert canonicalize("") == ""


def test_variants_collapse_to_same_key():
    a = canonicalize("http://www.ex.com/Story?utm_campaign=z")
    b = canonicalize("http://ex.com/Story/")
    assert a == b


# --- is_redirect -------------------------------------------------------------

def test_is_redirect_detects_grounding_host():
    assert is_redirect(
        "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AB12"
    )
    assert not is_redirect("https://techcrunch.com/article")


# --- _build_allowed_map (anti-hallucination citation filter) -----------------

def test_allowed_map_resolves_and_keys_by_canonical(monkeypatch):
    redirect = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AAA"
    monkeypatch.setattr(
        wg, "resolve_redirect", lambda u, **k: "https://www.real.com/news/?utm_source=g"
    )
    allowed = wg._build_allowed_map([redirect])
    # Keyed by the canonical form so candidate URLs match regardless of www/params.
    assert canonicalize("https://real.com/news") in allowed
    assert allowed[canonicalize("https://real.com/news")] == "https://www.real.com/news/?utm_source=g"


def test_allowed_map_drops_unresolvable(monkeypatch):
    monkeypatch.setattr(wg, "resolve_redirect", lambda u, **k: None)
    assert wg._build_allowed_map(["https://vertexaisearch.cloud.google.com/x"]) == {}


def test_allowed_map_dedupes_citations(monkeypatch):
    calls = []

    def fake(u, **k):
        calls.append(u)
        return "https://real.com/a"

    monkeypatch.setattr(wg, "resolve_redirect", fake)
    dup = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/Z"
    wg._build_allowed_map([dup, dup, dup])
    assert len(calls) == 1  # resolved once despite three citations
