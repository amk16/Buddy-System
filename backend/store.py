"""Storage — writes issues as dated JSON into the frontend's public/issues dir
and maintains index.json. Also reads prior issues to provide seen-URLs for dedup.

JSON is the contract between the Python backend and the React frontend; writing
into frontend/public/issues means a Vite build bundles issues as static assets.
"""

from __future__ import annotations

import json
from pathlib import Path

# backend/ -> project root -> frontend/public/issues
ISSUES_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "issues"
INDEX_PATH = ISSUES_DIR / "index.json"


def _ensure_dir() -> None:
    ISSUES_DIR.mkdir(parents=True, exist_ok=True)


def _issue_files() -> list[Path]:
    return sorted(p for p in ISSUES_DIR.glob("*.json") if p.name != "index.json")


def next_issue_id(date_str: str) -> str:
    """Date-based id; suffix -2, -3, ... if the day already has issue(s)."""
    _ensure_dir()
    if not (ISSUES_DIR / f"{date_str}.json").exists():
        return date_str
    n = 2
    while (ISSUES_DIR / f"{date_str}-{n}.json").exists():
        n += 1
    return f"{date_str}-{n}"


def load_seen_urls() -> list[str]:
    """Every item URL across all prior issues — used to avoid repeats."""
    urls: set[str] = set()
    for path in _issue_files():
        try:
            data = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        for section in data.get("sections", []):
            for item in section.get("items", []):
                if item.get("url"):
                    urls.add(item["url"])
    return sorted(urls)


def write_issue(issue: dict) -> Path:
    _ensure_dir()
    path = ISSUES_DIR / f"{issue['id']}.json"
    path.write_text(json.dumps(issue, ensure_ascii=False, indent=2))
    _rebuild_index()
    return path


def _rebuild_index() -> None:
    entries = []
    for path in _issue_files():
        try:
            data = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        item_count = sum(len(s.get("items", [])) for s in data.get("sections", []))
        entries.append(
            {
                "id": data.get("id", path.stem),
                "generated_at": data.get("generated_at", ""),
                "title": data.get("title", ""),
                "item_count": item_count,
            }
        )
    # Newest first.
    entries.sort(key=lambda e: e["generated_at"], reverse=True)
    INDEX_PATH.write_text(json.dumps(entries, ensure_ascii=False, indent=2))
