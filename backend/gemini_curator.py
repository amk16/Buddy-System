"""Gemini curator — the autonomous engine. Turns the candidate pool into a
curated issue via one structured Gemini call (Interactions API, structured
output). Run by ``pipeline.py --gemini`` and the scheduled GitHub Action.

Same contract and guarantees as ``curator.py`` (shared via ``curate_schema``):
the model may ONLY rank/rewrite pool items and copy their URLs verbatim — it adds
no tools here, so it introduces no new URLs. Output is run through
``validate.normalize``, the shared rule set. Returns ``None`` on any failure so a
bad run publishes nothing rather than a broken issue.
"""

from __future__ import annotations

import json
from typing import Optional

import validate
from config import Config
from curate_schema import CuratorOutput, system_prompt
from gemini_interactions import output_text


def gemini_curate(
    cfg: Config, pool: list[dict], seen_urls: list[str]
) -> Optional[dict]:
    """Returns the issue body {"brief": [...], "sections": [...]} or None."""
    if not pool:
        print("  [gemini-curator] empty pool — nothing to curate")
        return None

    try:
        from google import genai
    except ImportError:
        print("  [gemini-curator] google-genai not installed")
        return None

    try:
        client = genai.Client()  # reads GEMINI_API_KEY / GOOGLE_API_KEY
    except Exception as exc:  # noqa: BLE001
        print(f"  [gemini-curator] cannot init Gemini client: {exc}")
        return None

    user_payload = {
        "candidate_pool": pool,
        "already_seen_urls": seen_urls,
        "valid_signal_tags": list(validate.SIGNAL_TAGS),
    }
    prompt = (
        system_prompt(cfg)
        + "\n\nCurate this issue from the pool below. Return brief + sections.\n\n"
        + json.dumps(user_payload, ensure_ascii=False)
    )

    try:
        interaction = client.interactions.create(
            model=cfg.gemini_model,
            input=prompt,
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": CuratorOutput.model_json_schema(),
            },
        )
    except Exception as exc:  # noqa: BLE001 - network/SDK/quota all -> no issue
        print(f"  [gemini-curator] API call failed: {exc}")
        return None

    try:
        out = CuratorOutput.model_validate_json(output_text(interaction) or "{}")
    except Exception as exc:  # noqa: BLE001
        print(f"  [gemini-curator] unparseable output: {exc}")
        return None

    brief = [it.model_dump() for it in out.brief]
    sections = [
        {"id": s.id, "label": s.label, "items": [it.model_dump() for it in s.items]}
        for s in out.sections
    ]
    nb, ns = validate.normalize(cfg, brief, sections, seen_urls)
    return {"brief": nb, "sections": ns}
