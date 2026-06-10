# AI Marketing Pulse v2 — Refined Information Network (Design)

**Date:** 2026-06-10
**Status:** Approved by user (brainstorming session)

## Problem

A review of all generated issues found three quality gaps in what Kajol sees:

1. **"People to Watch" has been empty in every issue.** No source in the network
   produces people-shaped content; the one generic search query returns listicles.
2. **Brief cards shipped with empty summaries** in both recent issues. The
   curation step wrote them blank and nothing in the pipeline stops that, so the
   most prominent cards on the page are the weakest.
3. **The source network is thin and generic** — 8 broad tech feeds and 4 vague
   search queries. No coverage of ops/finance/customer-support verticals despite
   that being the stated focus, and no practitioner-grade sources that surface
   case-study material.

## North star (ranked)

When Kajol opens an issue with 10 minutes between calls, the feed optimizes for,
in order:

1. **Client-ready talking points** — things she can repeat to a client today.
2. **Personal learning** — plain-language explanations and terms that compound.
3. **Market radar** — shifts worth tracking early.

Reading load must not grow: worst-case issue stays at 15 cards.

## Changes

### 1. Sections (`backend/config.yaml`)

| Section | id | max_items | Notes |
|---|---|---|---|
| 🛠 Tools | `tools` | 5 | unchanged |
| 📰 News | `news` | 5 | down from 6 |
| 📊 Case Studies | `case_studies` | 3 | **new** — company + deployment + measurable result |
| 👤 People to Watch | `people` | 2 | down from 4 |

`brief_count` stays 3.

### 2. Source network (`backend/config.yaml`)

Tiered RSS list, ~20 feeds. **Every feed URL is verified (fetches and contains
recent items) before being added; broken candidates are dropped, not guessed.**

- **Tier 1 — practitioner voices** (feeds People + Case Studies): One Useful
  Thing (Ethan Mollick), Ben's Bites, Every, Marketing AI Institute, plus
  similar verified newsletter feeds.
- **Tier 2 — vertical trade press** (feeds Case Studies + News): CX Dive,
  CFO Dive, Supply Chain Dive, Retail Dive, VentureBeat AI, ZDNet AI, or
  equivalents that verify.
- **Tier 3 — general tech, pruned**: keep TechCrunch AI, MIT Tech Review, and
  1–2 of the current best; drop the noisiest generic feeds.

Web search queries become **section-specific** (replacing the 4 generic ones):
queries aimed at case-study results (e.g. "AI customer service cost reduction
results"), per-vertical tool launches, and named-voice activity for People.
Exact query list is finalized in the implementation plan.

### 3. Pipeline hardening (`backend/validate.py`)

- **Brief auto-fill:** in `normalize()`, each brief entry is matched by URL to
  its kept section item and inherits that item's full content (summary, terms,
  etc.). A blank Brief card becomes impossible.
- **Empty-summary gate:** any section item whose `summary` is empty/whitespace
  is dropped with a printed warning. (Per curation rules a fetch-blocked item
  still gets a shorter blurb-based summary — empty means the rule was violated.)

### 4. Curation rules (`CLAUDE.md`)

- Write in the ranked priority: talking points > learning > radar.
- Brief cards: sentence one of the summary must contain a concrete fact or
  number from the source.
- `why_it_matters` must be phrased as an action for a consultant ("pitch X to
  retail clients", "flag Y before any agent deployment").
- Define card shapes for the new/changed sections:
  - `case_studies`: company + what they deployed + measurable result (%, $,
    time) in sentence one; if a story has no measurable result it is News, not
    a Case Study.
  - `people`: a named person + what they just said/did (with URL to it) + why
    follow them; never invented, never a listicle entry.

## Not changing

- Frontend code: sections render from issue JSON, so `case_studies` should
  appear automatically — verify during implementation; if the frontend
  hardcodes section ids, the fix is part of the plan.
- `enrich.py` (stays a pass-through), `curator.py` API fallback, issue/archive
  format, no new UI widgets or fields.

## Error handling

- Feed verification at design-time (during implementation), not runtime: only
  verified feeds enter config. Runtime already skips unreachable feeds.
- Validation failures (empty summary) degrade gracefully: drop + warn, never
  abort the issue.

## Testing

- Run `python backend/pipeline.py --collect` and confirm the pool contains
  items from new Tier 1/2 sources.
- Unit-style check of `validate.normalize()` brief auto-fill and empty-summary
  gate (existing test conventions; if none exist, a small test file for
  validate.py).
- Generate one full trial issue and confirm: all 4 sections populated where the
  pool allows, no blank summaries anywhere, ≤15 cards.
