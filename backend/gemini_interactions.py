"""Tiny read helpers for the Gemini Interactions API response shape.

Targets ``google-genai >= 2.0`` (the ``steps`` schema — the May-2026 breaking
change; older 1.x clients are rejected server-side). An ``Interaction`` exposes
``output_text`` directly and a list of ``steps``; the model's text lives in
``model_output`` steps, and grounding citations are ``url_citation`` annotations
on that text. Both Gemini modules (curator + web collector) read through here so
they share one tolerant view of that shape.

Kept deliberately defensive: the Interactions API is still evolving, so we reach
fields via ``getattr`` and the ``type`` discriminator and degrade to empty rather
than raising if a future SDK reshapes a step or annotation.
"""

from __future__ import annotations


def output_text(interaction) -> str:
    """Return the model's text output from an ``Interaction``.

    Prefers the SDK's convenience ``output_text`` property; falls back to joining
    the ``text`` blocks of every ``model_output`` step. Returns ``""`` when there's
    no text — callers treat that as an empty JSON body and fail safe."""
    direct = getattr(interaction, "output_text", None)
    if isinstance(direct, str) and direct.strip():
        return direct.strip()

    parts: list[str] = []
    for step in getattr(interaction, "steps", None) or []:
        if getattr(step, "type", None) != "model_output":
            continue
        for block in getattr(step, "content", None) or []:
            if getattr(block, "type", None) == "text":
                text = getattr(block, "text", None)
                if isinstance(text, str):
                    parts.append(text)
    return "".join(parts).strip()


def citation_urls(interaction) -> list[str]:
    """Pull grounding citation URLs from an ``Interaction``.

    The trustworthy, search-backed URLs are the ``url_citation`` annotations the
    model attaches to its output text. We scan every step's content for them.
    Order-preserving; dedupe is the caller's job (it canonicalizes first)."""
    urls: list[str] = []

    def _add(value) -> None:
        if isinstance(value, str) and value.startswith("http"):
            urls.append(value)

    for step in getattr(interaction, "steps", None) or []:
        for block in getattr(step, "content", None) or []:
            for annotation in getattr(block, "annotations", None) or []:
                if getattr(annotation, "type", None) == "url_citation":
                    _add(getattr(annotation, "url", None))

    return urls
