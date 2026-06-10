"""Enrichment stage — PASS-THROUGH STUB (v1).

This is the designated home for the future high-value processing Kajol wants:
extracting cost-saving / ROI / case-study angles from the curated items to fuel
her social content and pitches. Building that is a later step. For now this is a
no-op so the pipeline shape (collect -> curate -> enrich -> write) is already in
place and the real logic can drop in here without rearchitecting.

Operates on the issue body dict {"brief": [...], "sections": [...]} so it is
engine-agnostic (works for both the Claude Code and API paths).
"""

from __future__ import annotations


def enrich(body: dict) -> dict:
    # TODO(later): add ROI / case-study / use-case extraction here.
    return body
