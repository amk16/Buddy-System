# Daily Report View (Design)

**Date:** 2026-06-11
**Status:** Approved by user (brainstorming session)

## Problem

The dashboard shows each issue as skimmable cards — great for triage, but it
doesn't *explain*. Kajol needs a connected, non-technical narrative of what the
day's findings mean: the threads between stories, written like a smart
analyst's memo, finishable in well under 15 minutes, with every claim traceable
to its source.

## What it is

A **Report view** per issue, toggled against the existing card **Feed** in the
dashboard. A thematic briefing: a one-paragraph lede framing the day, then 2–4
themes that each connect multiple items into one story. Same warm-paper design
(`pulse-design` governs). Issues without a report (all pre-existing ones) show
no toggle and render exactly as today.

## Data contract

`report` is an optional top-level field of the issue JSON (and of
`curated.json`):

```json
"report": {
  "lede": "One opening paragraph framing the day.",
  "themes": [
    {
      "title": "AI pricing is splitting in two",
      "paragraphs": [
        "Prose with [inline source links](https://example.com/article) only."
      ]
    }
  ]
}
```

- Paragraph text supports exactly one markup form: `[label](url)` links.
  No other markdown.
- Lives inside the issue file → archive switching, storage, and the index need
  zero changes.

## Grounding enforcement (backend/validate.py)

New `normalize_report(report, kept_urls) -> dict | None`, called from
`normalize()`'s flow (pipeline passes the kept item URLs):

1. **Citation grounding:** every `[label](url)` URL must be the URL of an item
   kept in this issue. A link to any other URL is stripped to its plain label
   with a printed warning. The report cannot cite what the feed doesn't carry.
2. **Length cap:** total words (lede + titles + paragraphs) ≤ 3,300
   (≈15 min at 220 wpm). Over the cap → drop trailing themes until under it,
   with a printed warning.
3. **Shape:** 2–4 themes, each with non-empty `title` and ≥1 non-empty
   paragraph; non-empty `lede`. Malformed themes are dropped; if fewer than 2
   themes survive or the lede is empty, the whole report is dropped (warning)
   — the issue itself is still valid.
4. Report is optional: `None`/missing passes through as no report.

## Generation (CLAUDE.md step 5b)

After writing the card body, write `report` into the same `curated.json`:

- Voice: plain language for a non-technical reader; gloss jargon in-line; no
  hype, no urgency framing, no deadline countdowns.
- Target 900–2,500 words (hard cap 3,300 enforced downstream).
- Every number, named company, or claim carries an inline `[source](url)` link
  whose URL is one of the issue's items.
- Each theme connects at least two of the issue's items; the lede mentions all
  `brief` stories.
- Themes answer "why does this matter to her consulting work", not just "what
  happened".

## Frontend

- **`frontend/src/lib/linkify.tsx`** — parses `[label](url)` in a string into
  React elements (`<a target="_blank" rel="noreferrer">`). Pure string
  parsing; no `dangerouslySetInnerHTML`, no HTML pass-through. Unmatched
  brackets render as literal text.
- **`frontend/src/components/Report.tsx`** — renders lede (slightly larger,
  like a standfirst), then themes: title styled like section labels (terracotta
  rule), paragraphs in Fraunces body at a comfortable measure (~62ch).
- **View toggle** in `App.tsx`: a quiet sans segmented control `Feed | Report`
  under the masthead, shown only when the current issue has a report. State
  resets to Feed when switching issues.
- **Reading-time chip:** in Report view it shows the report's own estimate
  ("~7 min read", computed by the existing word-count approach); in Feed view
  it shows the existing skim/full pair.
- Types: `Report`, `Theme` added to `frontend/src/lib/types.ts`; `Issue` gains
  optional `report`.

## Error handling

- All report validation degrades gracefully (strip/drop + warn, never abort an
  issue).
- Frontend renders no toggle when `report` is absent or malformed-empty.

## Testing

- pytest for `normalize_report`: ungrounded-link stripping, word cap, theme
  count floor/ceiling, malformed shapes, optional/missing report, grounded
  report passes through intact.
- Frontend: `npm run build` + lint; `pulse-design-review` loop over the Report
  view (desktop/mobile captures of the report state).
- Generate a real report for the existing 2026-06-10 issue via the curation
  engine and persist it, so the feature is visible immediately.

## Out of scope

- Print/PDF stylesheet, email delivery, backfilling reports for issues before
  2026-06-10, any changes to `enrich.py`/`curator.py` (API engine may simply
  not produce reports).
