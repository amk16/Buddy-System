# Reader Feedback Loop (Design)

**Date:** 2026-09-22
**Status:** Approved by Ali (brainstorming session, research-first)

## Problem

The Pulse stream publishes an issue a day for Kajol with no signal coming back. The
curation lens (`relevance_focus` in `backend/config.yaml`) was written once in June and
has never been corrected by her. Tools and news dominate, people runs thin, and nobody
knows whether that mix matches what she finds useful.

## What it is

Three connected pieces:

1. **Capture.** Kajol reacts to cards (More like this / Less like this, a second tap
   for "loved", lever-mapped reason chips, no free text) and to an issue as a whole
   (useful / fine / noise). Two implicit signals are logged silently: a card's Details
   opened, and a headline clicked. The visible reaction component is designed
   separately; this spec covers the event contract, transport, and storage.
2. **Profile and direction estimate.** Each pipeline run turns the feedback into a
   reader profile: per-section net score with recency decay, section mix *current*
   versus *ideal*, reason-chip tallies, and LLM-proposed emergent axes with evidence.
   Direction = ideal minus current, per axis, with confidence from sample size.
3. **Steer with review.** The run writes a proposed steer (a short paragraph plus
   section weights). Nothing changes until Ali accepts it, after which the curation
   prompt carries a READER PROFILE block. Ali reads the profile as a local HTML report
   that is never served.

## Research basis (2026-09-22)

- Binary beats scales; one intensity step preserves "loved" (Netflix stars→thumbs:
  +200% ratings; "double thumbs up" added in 2022).
- Generic negatives barely steer; targeted reasons do (Mozilla/YouTube: Dislike 12%,
  Not interested 11%, "Don't recommend channel" 43%). Every Less carries a reason
  mapped to a lever the curator controls.
- The content she reacted to is explicit context an LLM can distill into aspect tags
  (arXiv 2605.29141, 2604.01463).
- Feedback dies on effort, doubt of impact, and no visible landing (arXiv 2602.01405):
  quick actions, progressive disclosure, visible acknowledgement.
- One-click issue-level polls work; surveys get 2–5% (Inbox Collective).
- Implicit signals measure engagement, not satisfaction: low weight (ACM SAC 2018).
- Preferences drift: half-life decay (CEUR half-life model).
- Pairwise comparison is too fatiguing for a gap between calls: not used.

## Data contract

Event (frontend `types.ts` ↔ `api/_lib/schema.ts` ↔ `backend/reader_profile.py`):

```json
{ "v": 1, "id": "uuid", "ts": "2026-09-22T10:00:00.000Z", "client_id": "uuid",
  "issue_id": "2026-09-20", "engine": "gemini", "url": "<raw url as stored in the issue>",
  "kind": "more | loved | less | undo | open | click | issue",
  "reasons": ["too_technical"], "value": "useful | fine | noise", "section": "tools" }
```

`reasons` only with explicit kinds; `value` only with `kind = issue`. Chip ids are one
shared list in `frontend/api/_lib/schema.ts` (provisional until the component design).

Storage: `feedback/YYYY-MM.jsonl` on the git branch `feedback` (never `main`), one
event per line, appended by the Vercel function through the GitHub Contents API.
`vercel.json` disables deployments for that branch.

## Transport

`frontend/src/lib/feedback.ts`: `setContext`, `record`, `flush`, `install`. Queue in
localStorage (`pulse.feedback.v1`, capped at 200, oldest dropped) with an in-memory
mirror when storage is unavailable; flush in batches of 50 on tab hide, page hide, or
4 s idle, via `sendBeacon` with `fetch keepalive` fallback; events removed by id only
after the server accepts. In `vite dev` with no endpoint override the batch is logged
and cleared.

`frontend/api/feedback.ts` (Vercel Function, web signature): POST only, exact-match
origin allowlist, 64 KB body cap, schema validation with unknown keys stripped, dedupe
by event id within the target file, GET→merge→PUT with three conflict retries, 204 on
success. Env: `GITHUB_TOKEN` (fine-grained PAT, contents:write), `GITHUB_REPO`,
`FEEDBACK_BRANCH`, `FEEDBACK_ALLOWED_ORIGINS`.

## Profile computation (`backend/reader_profile.py`)

Deterministic layer (testable, explainable):
- Weights: loved 2, more 1, less −1, click 0.5, open 0.25; issue check-in useful +1 /
  fine 0 / noise −1 spread evenly over the issue's sections.
- Decay `0.5 ** (age_days / half_life_days)`, half-life from config (30).
- `undo` removes the prior explicit reaction for the same (client, canonical url);
  implicit events count once per (client, url, kind).
- Items matched through `url_resolve.canonicalize` on both sides.
- Per section: net, positive mass, counts, `confidence = 1 − exp(−n/8)`,
  `mix_current` (item share over the 14 newest issues), `mix_ideal` (normalized
  positive mass; falls back to current below `min_explicit_for_proposal`),
  `direction = ideal − current`. Chip tallies decayed and split by kind.

LLM layer (same engine as the run; skipped below the explicit floor):
- Input: top-k loved/more and less items (card content only), chip tallies, section
  mix. Output schema: emergent axes `{name, definition, evidence_urls, current, ideal}`,
  `profile_summary` (≤120 words), `proposed_steer` (≤120 words), `section_weights`.
- Hard rule: evidence URLs must come from the input; axes without evidence are
  dropped. Values clamped. The Claude Code engine authors the proposal in-session from
  `backend/profile_evidence.json`, mirroring the pool/curated pattern.

Outputs on `main`, outside `frontend/`: `profile/profile.json`,
`profile/proposal.yaml` (only when a proposal exists), `profile/report.html`
(self-contained, buddy-system tokens, opened locally).

## Steer

`backend/steer.yaml` (committed) holds the active steer; `config.py` merges it into
`Config.steer` and `Config.section_weights`. `pipeline.py --accept-steer` copies the
pending proposal into it. `curate_schema.system_prompt(cfg, steer)` adds a READER
PROFILE block after THE READER paragraph only when a steer is set; the Anthropic path
appends it as an uncached second system block; `pool.json` carries `reader_profile`
for the Claude Code engine, with a matching rule in `CLAUDE.md`.

## Pipeline and Action

`_persist` runs profile generation after the issue is written, for all engines,
inside a guard that can never fail the publish. New verbs: `--profile` and
`--accept-steer`. The Action fetches the `feedback` branch before the run and adds
`profile/` to the publish commit; the change guard stays keyed on the issue.

## Out of scope

The reaction component UI (glyphs, chips, issue check-in, acknowledgement): its own
design under the buddy-system skill, starting from Ali's thoughts. Auto-steer without
review. Serving the profile from Vercel.

## Revisions (2026-09-22)

- The profile module was renamed `backend/profile.py` → `backend/reader_profile.py`
  throughout the codebase; this spec's references are updated above.
- The transport uses `fetch` with `keepalive` only. `sendBeacon` was dropped: it cannot
  carry a JSON content-type reliably across browsers, and `fetch keepalive` covers the
  idle, hidden and unload cases on its own. Events are removed from the queue only after
  a 2xx response; a 400 (the server rejecting the whole batch outright) drops that batch
  without retrying it, while 403/5xx/network failures stay queued and retry with backoff.
- A month's storage file (`feedback/YYYY-MM.jsonl`) that grows too large for the Contents
  API to read rolls over to a numbered continuation (`-2` through `-9`); the backend reads
  every `feedback/*.jsonl`, so a rolled month is still one history.
- The proposal lifecycle carries an `accepted_at` stamp: `--accept-steer` refuses to apply
  a proposal a second time once it has been stamped.
