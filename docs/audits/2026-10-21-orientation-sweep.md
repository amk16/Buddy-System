# Orientation sweep — 2026-10-21

A measured check that every container sits on the same edges, every gap is a token, nothing is clipped, off-centre or overflowing, at every width and in every view. Run against the dev build of `ui-refresh` after v1.5.0; the fix it produced ships as v1.5.1.

## Instrument

Headless Chromium (Playwright 1.60) against the dev server. For each state and width it reads the bounding box of every structural element (`.app` and its padding, topbar and its controls, masthead, h1, dialog, portrait and its image, nameplate, main and its children, glance heading, Brief and its items, bento and every tile with label / headline / peek, takeover and its inner column, every section with its label and cards, each card's source / toggle / heart / chips, footer, empty and recovery states, the boot cover's sheet / screen / readout / stamp / wordmark letters) and the computed styles the checks need, then asserts in Node with a 1px tolerance. Script: `orient.mjs` (session scratchpad; not in the repo).

States: glance (plus each section tile hovered, hover-capable contexts), Tools takeover with a card's Details open, feed, boot cover at 2.5 s (motion on), empty (index blocked), error (issue blocked). Widths 1440 · 1280 · 1024 · 768 · 600 · 561 · 560 · 481 · 480 · 390 · 320; height 900, plus 700 at 1440 and 1280. **44 states measured.**

## Checks

1. Column edges: topbar, masthead, dialog, main and footer on the `.app` content box; Brief on the left edge; bento on the right; half tiles on the bento's edges; wide tiles spanning it; takeover inner column centred (equal remainders) with its cards on its edges; feed Brief, sections and cards on one left edge.
2. Vertical rhythm: topbar→h1 32, h1→dialog 12, masthead→kicker 48, kicker→Brief 24, Brief↔bento 24, tile↔tile 24 (rows and columns), card↔card 16, section↔section 48, tape padding 24; back-link→label on the 4px scale.
3. Centring: h1 on the app box; takeover inner; boot screen on the viewport; empty state; recovery panel.
4. Overflow and clipping: `scrollWidth` = viewport; no text box past the viewport's right edge; tile headlines within their clamp; the peeking buddy never intersecting a tile's label, headline or "…and more inside"; the portrait image covering its frame.
5. Hit targets: every button, select, back link, feed link and retry ≥ 40px tall; the heart 40×40; chips ≥ 40.
6. Rows: topbar controls on one centre line; nameplate overlap constant; card source and Details toggle on one centre line when on one line.
7. Cross-view: masthead top and height identical in glance, takeover and feed at each width (the feed's masthead is narrower by design: the reading column).
8. Boot cover: sheet = viewport; screen centred; readout label and stamp on one top line (2px nudge, by design); wordmark letters inside a 16px gutter.
9. Breakpoints bracketed at 561/560 and 481/480.

## First run: 48 drifts, one real

| Finding | Verdict |
|---|---|
| Nameplate overlap measured 10, expected 12, at every width | Instrument: `top: -12px` is from the box's padding edge; the 2px border makes it 10 from the outer edge. Constant everywhere. Not a drift; check corrected. |
| Feed masthead narrower than the glance's | By design (720 reading column vs 1040 glance). Check corrected to compare top and height only. |
| At 600 and 561 the glance's tiles failed the edge check | Instrument misread the two-column bento under a one-column glance. Corrected. |
| **At 600 the peeking buddy crossed tile text (tile 3)**, and half tiles measured 140px wide (52px of text column), 129px at 561, 188px (100px of text) at 768 | **Real.** The two-column glance held on down to 561px. |

Half-tile text column by width, before the fix:

| Width | Half tile | Text column |
|---|---|---|
| 1440 / 1280 | 266 | 178 |
| 1024 | 262 | 174 |
| 768 | 188 | 100 |
| 600 | 140 | 52 |
| 561 | 129 | 41 |

**Fix (v1.5.1):** the glance collapses to Brief-over-bento at `max-width: 900px` (new block in `frontend/src/index.css`); the bento keeps two columns until 560 as before. Pinned in `cssContract.test.ts`; the law's Layout section carries the rule.

## Final run: 44 states, 0 drifts

| Width | App pad | Glance | Bento cols | Portrait | Dialog | Masthead h | masthead→kicker / kicker→Brief |
|---|---|---|---|---|---|---|---|
| 1440 | 24 | Brief beside bento | 2 | 112×112 | row | 247 | 48 / 24 |
| 1280 | 24 | Brief beside bento | 2 | 112×112 | row | 247 | 48 / 24 |
| 1024 | 24 | Brief beside bento | 2 | 112×112 | row | 247 | 48 / 24 |
| 768 | 24 | Brief over bento | 2 | 112×112 | row | 247 | 48 / 24 |
| 600 | 24 | Brief over bento | 2 | 112×112 | row | 245 | 48 / 24 |
| 560 | 24 | Brief over bento | 1 | 92×92 | row | 222 | 48 / 24 |
| 480 | 16 | Brief over bento | 1 | 92×92 | row | 236 | 48 / 24 |
| 390 | 16 | Brief over bento | 1 | 92×92 | row | 257 | 48 / 24 |
| 320 | 16 | Brief over bento | 1 | 92×92 | row | 279 | 48 / 24 |

Other measured constants: takeover inner column remainders 136 / 136 at 1280; back-link→label 32; card↔card 16; section↔section 48 with 24 tape padding; footer 64 below the last block in every view; boot screen centred at 640 of 1280 with the wordmark 43px inside each edge; every control ≥ 40px; no horizontal overflow at any width; no text past the viewport; the portrait image covers its frame at 112 and 92.

## Notes, not drifts

- The nameplate sits 10px above the box's outer edge (12 above its padding edge). Consistent; leave unless the chip is ever redrawn.
- On a hash navigation the takeover's label receives programmatic focus and a focus-visible ring can show in automated captures; this is the existing keyboard-access behaviour, not layout.
- The five-item Brief running below the tile wall was ruled by Ali after this sweep: on the glance the Brief now stretches to the wall and each item clamps to three lines (full lines in the feed); the bento stretches to the row and spreads any px of difference into its gaps (24.9 at 1280, within tolerance). RoboBuddy was also re-centred in the portrait from the PNG's measured figure bounds. Both re-measured: 0 drifts.
