"""RSS collector — parses configured feeds into RawItems.

Feeds that error or are unreachable are skipped with a warning, so one bad feed
never breaks a run. Items older than lookback_days are dropped.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone

import feedparser

from . import RawItem

# Be a polite client; some feeds reject the default urllib UA.
_UA = "AIMarketingPulse/1.0 (+https://example.local)"


def _entry_datetime(entry) -> datetime | None:
    for key in ("published_parsed", "updated_parsed"):
        parsed = entry.get(key)
        if parsed:
            return datetime.fromtimestamp(time.mktime(parsed), tz=timezone.utc)
    return None


def _clean(text: str, limit: int = 500) -> str:
    # feedparser already strips most markup; collapse whitespace and cap length.
    text = " ".join((text or "").split())
    return text[:limit]


def collect_rss(feed_urls: list[str], lookback_days: int) -> list[RawItem]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    items: list[RawItem] = []

    for url in feed_urls:
        try:
            parsed = feedparser.parse(url, agent=_UA)
        except Exception as exc:  # noqa: BLE001 - one bad feed shouldn't halt the run
            print(f"  [rss] skipped {url}: {exc}")
            continue

        if parsed.bozo and not parsed.entries:
            print(f"  [rss] skipped {url}: unreadable feed")
            continue

        source_name = _clean(parsed.feed.get("title", url), limit=80)
        kept = 0
        for entry in parsed.entries:
            link = entry.get("link")
            title = _clean(entry.get("title", ""), limit=200)
            if not link or not title:
                continue

            when = _entry_datetime(entry)
            if when and when < cutoff:
                continue

            items.append(
                RawItem(
                    title=title,
                    url=link,
                    source_name=source_name,
                    summary=_clean(entry.get("summary", "")),
                    published_at=when.date().isoformat() if when else None,
                    origin="rss",
                )
            )
            kept += 1
        print(f"  [rss] {source_name}: {kept} recent items")

    return items
