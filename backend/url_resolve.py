"""URL helpers for the grounded Gemini engine.

Google Search grounding hands back citation URLs on the host
``vertexaisearch.cloud.google.com/grounding-api-redirect/...``. Those are
short-lived redirects that EXPIRE after a few days — useless as the permanent,
clickable publisher links this feed promises. ``resolve_redirect`` follows them
once to the real destination so the issue stores a stable URL.

``canonicalize`` is a pure, network-free normalizer used to (a) match a
candidate's URL against the set of grounding-cited URLs and (b) dedupe. Keeping
it pure makes it unit-testable and reusable by the seen-URL dedupe layer later.
"""

from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

REDIRECT_HOST = "vertexaisearch.cloud.google.com"

# Query params that are tracking noise, never identity. Anything starting with
# "utm_" is also dropped (handled in code, not listed here).
_TRACKING_PARAMS = frozenset(
    {
        "gclid",
        "fbclid",
        "msclkid",
        "mc_cid",
        "mc_eid",
        "ref",
        "ref_src",
        "source",
        "cmpid",
        "_hsenc",
        "_hsmi",
        "igshid",
        "spm",
    }
)


def canonicalize(url: str) -> str:
    """Normalize a URL for matching/dedupe — lower-case scheme+host, drop ``www.``
    and a trailing slash, and strip tracking query params. Idempotent. Returns the
    input unchanged if it can't be parsed as http(s)."""
    if not url:
        return ""
    url = url.strip()
    parts = urlparse(url)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        return url

    scheme = parts.scheme.lower()
    host = parts.netloc.lower()
    if host.startswith("www."):
        host = host[4:]

    kept = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=False)
        if not (k.lower().startswith("utm_") or k.lower() in _TRACKING_PARAMS)
    ]
    query = urlencode(kept)

    path = parts.path
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")

    # Drop fragments — they never identify a distinct article.
    return urlunparse((scheme, host, path, parts.params, query, ""))


def is_redirect(url: str) -> bool:
    """True if ``url`` is a Google grounding redirect that must be resolved."""
    try:
        return urlparse(url).netloc.lower().endswith(REDIRECT_HOST)
    except ValueError:
        return False


def resolve_redirect(url: str, *, timeout: float = 6.0) -> str | None:
    """Return the final publisher URL for a grounding redirect (or ``url`` itself
    if it isn't one). Returns ``None`` on network error/timeout or if the redirect
    still points at the grounding host — i.e. when no real source could be reached.

    Imports ``requests`` lazily so modules that only need ``canonicalize`` (and the
    unit tests) don't require the dependency."""
    if not url:
        return None
    if not is_redirect(url):
        return url

    try:
        import requests
    except ImportError:
        return None

    try:
        resp = requests.head(
            url,
            allow_redirects=True,
            timeout=timeout,
            headers={"User-Agent": "AIMarketingPulse/1.0"},
        )
    except requests.RequestException:
        return None

    final = resp.url or ""
    if not final or is_redirect(final):
        return None
    return final
