# Engine separation — Claude / Gemini tab

**Date:** 2026-06-29
**Status:** Approved

## Problem

Issues are now produced by two engines — the human-reviewed **Claude** flow
(Claude Code `--write` and the Anthropic API path) and the autonomous **Gemini**
stream. They land in one undifferentiated archive. Kaj wants to see them
separately and switch between the two.

## Solution

Tag every issue with the engine that produced it, then add a segmented pill
toggle `[ Claude | Gemini ]` in the topbar that filters the issue archive to one
engine at a time.

## Data model

- `Engine = "claude" | "gemini"`.
- `_build_issue()` gains an `engine` field; `_persist()` threads it through.
- Call sites: `write_curated` (Claude Code) → `claude`; `run_api` (Anthropic) →
  `claude`; `run_gemini` → `gemini`; `write_sample` → `claude`. Both Claude paths
  read as "Claude" to the reader.
- `store._rebuild_index()` carries `engine` into each index entry, defaulting to
  `"claude"` when a file lacks it — this auto-backfills the 8 historical issues +
  sample (all predate Gemini).
- One-time backfill: write `"engine": "gemini"` into the existing
  `2026-06-29.json` (generated via Gemini during engine bring-up).

## Frontend

- `types.ts`: add `Engine` and `engine: Engine` on `IndexEntry`.
- New `EngineTabs.tsx`: the segmented pill. Both segments always render; the
  active one uses the existing gold Scribbld accent. An engine with zero issues
  renders disabled (visible separation, but can't land on an empty archive).
- `App.tsx`:
  - `engine` state initialized from `localStorage` (remember last choice),
    falling back to the engine of the latest overall issue when the stored value
    has no issues.
  - The `ArchiveSwitcher` date dropdown receives only the current engine's
    entries.
  - Switching tabs selects that engine's newest issue and persists the choice;
    content swaps wholesale (same path as today's issue switch — no morph).
- `ArchiveSwitcher` unchanged — it receives a pre-filtered list and still hides
  itself when an engine has ≤1 issue.

## Edge cases

- Stored engine now empty → fall back to latest-overall engine.
- Engine with a single issue → date dropdown hidden (existing rule); the pill
  alone drives navigation.
- Unknown/missing `engine` in older data → treated as `claude`.

## Out of scope (YAGNI)

Per-card engine badges, a merged "all" view, engine analytics.

## Verification

- Backend: `pytest` green; index rebuild emits `engine` per entry.
- Frontend: `npm run build` clean; pulse-design-review on the tab UI.
