"""API curator — OPTIONAL engine. Turns the candidate pool into a curated issue
via one structured Claude API call. Used by `pipeline.py` (no args) when you have
an ANTHROPIC_API_KEY and want a fully-autonomous run.

The default, no-cost engine is Claude Code itself (see CLAUDE.md, `--collect` /
`--write`). This module is kept so the API path still works if you ever want it.

Hard guarantees (enforced here + in validate.py):
- The model may ONLY rank/summarize items present in the provided pool. Every
  output item must carry a `url` from the input. No invented items.
- Items whose URL appears in seen_urls (prior issues) are excluded.
- Output is validated against validate.normalize — the shared rule set.
"""

from __future__ import annotations

import json
from typing import Optional

import anthropic

import validate
from config import Config
from curate_schema import CuratorOutput, system_prompt as _system_prompt

MODEL = "claude-opus-4-8"


def curate(cfg: Config, pool: list[dict], seen_urls: list[str]) -> Optional[dict]:
    """Returns the issue body {"brief": [...], "sections": [...]} or None."""
    if not pool:
        print("  [curator] empty pool — nothing to curate")
        return None

    try:
        client = anthropic.Anthropic()
    except Exception as exc:  # noqa: BLE001
        print(f"  [curator] cannot init Anthropic client: {exc}")
        return None

    user_payload = {
        "candidate_pool": pool,
        "already_seen_urls": seen_urls,
        "valid_signal_tags": list(validate.SIGNAL_TAGS),
    }

    try:
        # messages.parse injects output_config={"format": <schema>} from output_format
        # — don't pass our own output_config (collides). effort defaults to "high".
        resp = client.messages.parse(
            model=MODEL,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=[
                {
                    "type": "text",
                    "text": _system_prompt(cfg),
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": "Curate this issue from the pool below. Return brief + sections.\n\n"
                    + json.dumps(user_payload, ensure_ascii=False),
                }
            ],
            output_format=CuratorOutput,
        )
    except anthropic.APIError as exc:
        print(f"  [curator] API error: {exc}")
        return None

    if resp.parsed_output is None:
        print(f"  [curator] no structured output (stop_reason={resp.stop_reason})")
        return None

    out = resp.parsed_output
    brief = [it.model_dump() for it in out.brief]
    sections = [
        {"id": s.id, "label": s.label, "items": [it.model_dump() for it in s.items]}
        for s in out.sections
    ]
    nb, ns = validate.normalize(cfg, brief, sections, seen_urls)
    return {"brief": nb, "sections": ns}
