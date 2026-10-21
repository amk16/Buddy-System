# Colour and whitespace audit — 2026-10-21

Scope: the dashboard as it stands on `ui-refresh` after the boot cover (`frontend/src/index.css`, the components under `frontend/src/components/`, `frontend/src/lib/signature.ts`, `frontend/src/lib/buddy.ts`). Line numbers refer to `index.css` unless a file is named. The law is `.claude/skills/buddy-system/SKILL.md`; nothing below proposes leaving it, only using it better.

Companion: the three directions in `docs/lab/palette-fusion/` (served from the repo root: `python3 -m http.server 8790`, then `/docs/lab/palette-fusion/`).

## Part 1 — Colour

### 1.1 Where every token goes today

| Token | Uses | Role and where |
|---|---|---|
| `--paper` `#faf7f0` | 4 | page ground (139); boot sheet; text on the active engine tab (389); takeover fallback (710) |
| `--card` `#fffdf8` | 3 | fill of `.tile` (450), `.card` (826), `.recovery` (1446) |
| `--cream-2` `#f3eee2` | 8 | recessed fills: select (335), engine tabs (363), feed tile (598), resume chip (635), terms box (1344), chips (1400, 1418), code (1434) |
| `--brief-bg` `#fdf3cd` | 2 | `.bd-box` (267) and `.brief` (745): the same butter twice in a row on the front door |
| `--border` `#e7e0d2` | 10 | every hairline on the page |
| `--border-strong` `#d8cfba` | 1 | disabled engine-tab text (398). Defined "for section rules"; no section rule uses it |
| `--ink` `#2c2a26` | 17 | primary text; 2px frames on the portrait and dialog (248, 268); nameplate fill (279); the ink half of the sliver (566, 814) |
| `--ink-soft` `#5f594e` | 23 | secondary text everywhere; heart cells on hover (1131) |
| `--accent` `#6e530e` | 14 | links, focus ring, caret, Brief left edge (747), list markers, active tab fill (388), pressed-chip edge, heart tip, halo, ring |
| `--accent-deep` `#574108` | 5 | hover states |
| `--brand-yellow` `#ffd700` | 8 | underlines on links, feed-link, card headline, retry (173, 694, 882, 1473); slivers under tiles and section labels (566, 814); super-like heart cells (1157); nameplate **text** (280) |
| tag tints (3 pairs) | 1 each | kicker pills only (857–870) |
| signatures (`signature.ts:17–22`) | 2 each | `--sig` = tile left edge + label (537–548) + takeover label (725); `--sig-bg` = tile wash + whole takeover ground (710) |
| face palettes (`buddy.ts:59–64`) | hover + cover | five vivid hues per section, otherwise invisible |

### 1.2 Findings

1. **Butter twice in a row.** `.bd-box` and `.brief` both use `--brief-bg`. With the tools tint `#f5ecd6`, `--cream-2` `#f3eee2` and butter `#fdf3cd` a few values apart, the gold tile, the Brief and the feed tile read as one family. The front door has no figure/ground step: nothing is lifted, nothing recedes.
2. **One hairline for everything.** All ten hairlines are `--border`. On butter, `#e7e0d2` on `#fdf3cd` is nearly invisible, so the Brief's own edge and the rules inside an opened card disappear. `--border-strong` exists for section rules and is never used as one; feed sections are separated by a 48px margin and the sliver alone.
3. **Signatures are washes, not marks.** The section hue is spent as a whole-tile wash and a whole-takeover ground, plus a 3px edge. Spent that wide it reads as tinted paper, not as a mark. Three of the four signature pairs are the tag-pill pairs (tools = shift, news = trending, case_studies = new), so a news takeover shows trending pills in its own ground colour.
4. **The face palettes are hidden.** The five-hue palettes in `buddy.ts` are the product's most vivid, most characterful colour and they appear only on hover and in the boot cover.
5. **Hierarchy by size alone.** Section label vs card headline is ink on ink at `--fs-lg` vs `--fs-md` (803 / 874); tile label vs headline is `--fs-md` vs `--fs-sm`. Nothing but scale separates the levels.
6. **The brand highlight is wrong, and used as text.** The nameplate (273–285) is yellow text on ink, which the law never sanctions ("brand-yellow is never text"). And the token itself is off-brand: the Scribbld highlight is `#F78D1D`, not `#ffd700` (Ali, 2026-10-21).
7. **Contrast facts for the corrected highlight.** `--ink` on `#F78D1D` = 5.9:1 (text-safe: the nameplate can be ink on highlight). `#F78D1D` on paper = 2.2:1 and on card = 2.3:1 (decoration only, exactly as the yellow is used today for underlines and slivers). `--ink` on a 10% highlight-into-paper mix stays above 12:1.
8. **Signature pairs are not in the law's contrast table**; a comment in `signature.ts` carries them. `--maxw-glance` is in the CSS and not in the SKILL token block.

### 1.3 The highlight migration (all 8 uses of `--brand-yellow`)

| Use | Today | Proposed |
|---|---|---|
| link underlines, feed-link, retry (173, 694, 1473) | `#ffd700` 2px | `#F78D1D` 2px |
| card headline resting underline (882) | `#ffd700` 2px | `#F78D1D` 2px |
| sliver under tiles and section labels (566, 814) | ink over `#ffd700` | ink over `#F78D1D` (or the direction's pixel row) |
| super-like heart core cells (1157) | `#ffd700` | **decide at pick time**: `#F78D1D` for one highlight everywhere, or keep marker yellow on the heart only |
| nameplate (280) | yellow text on ink | ink text on `#F78D1D` chip |

Token plan: add `--brand-highlight: #f78d1d`; `--brand-yellow` stays defined only if the heart keeps it, otherwise it is removed and the law's wording changes from "marker yellow" to "the highlight".

## Part 2 — Whitespace

### 2.1 Tokens and strays

Scale `--sp-1..8` = 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 (41–48). Values off the scale: `top: -12px` (277, on-grid but ad hoc), `padding: 2px` (285), `margin-left: 1px` (307), `gap: 1px` (352), radius `5px` (378–384), `padding-right: 76px` (474), `calc(var(--sp-1) + 2px)` = 6px (936), `gap: 6px` (1554), `+2px` (1598), `gap: 2px` (1602), `min-height: 40px` (hit target, sanctioned), portrait `112px` / `92px`.

### 2.2 The glance's vertical rhythm (`.app` padding 32 / 24 / 64, line 186)

| Step | Space | Lines |
|---|---|---|
| topbar → h1 | 24 margin + 8 gap = 32 | 224, 202 |
| h1 → dialog | 8 gap + 4 margin = 12 | 202, 233 |
| dialog → "At a glance" | 48 | 197 |
| heading → Brief / bento | 24 | 408 |
| Brief ↔ bento column | 24; the bento's own gap is 16 | 408, 432 |
| buddy corner (when present) | 24 + 8 | 630 |
| → footer | 64 margin + 64 padding | 1484 |

### 2.3 Findings

1. **The masthead box's height is leftover, not chosen.** The portrait frame is 112px wide and crops a 150%-wide image, so it is about 235px tall; `align-items: stretch` (230) drags `.bd-box` to the same height around one greeting line and one meta line. Three reviewers flagged it today: it is the largest butter object on the page and the emptiest, and it pushes the Brief to y≈500 on a 900px viewport.
2. **Sibling gaps disagree.** Brief-to-bento 24 but bento 16; Brief padding 24 / 24 / 16 (749); inside a card the summary rule is 12 margin + 12 padding, the terms box 16 margin, the chips rule 16 margin + 12 padding (1335–1343, 1373).
3. **Hero tile safe-zone bug.** `.tile-wide { padding: var(--sp-5) }` (552) comes after the hover query's `padding-right: 76px` (474) at equal specificity, so the wide tile's right padding drops to 24px and the peeking buddy (about 69px of the right edge) covers text. This breaks SKILL "never covers text".
4. **Half tiles are cramped.** At 1040px the bento column is about 590px; a half tile is about 287px; minus 16 + 76 of padding the text column is about 195px, and at the 560–1040 range it falls below 176px.
5. **Takeover bottom padding 64 (712) meets the footer's margin 64 (1484):** 128px of nothing before "Private feed".
6. **Width law mismatch.** SKILL (§Layout) says the bento lives inside the 720px column; the code runs the glance and the takeover at `--maxw-glance` 1040px (App.tsx: `.app-glance` for both views).
7. **Feed sections have no rule**, only margin and the sliver (797–821); the eye has to find the next serif label.

### 2.4 Improvement plan (ranked by effect; all directions carry it)

1. **Masthead to content height.** Portrait frame `112 x 112` at every width (the ≤480 crop today, which also closes the boot-cover ratio note); `.buddy-dialog { align-items: flex-start }`; `.bd-box { min-height: 0; padding: var(--sp-4) var(--sp-5) }`. Box ≈ 110px instead of 235px; the Brief lands above the fold at 900px.
2. **One rhythm.** Brief-to-bento and bento gap both `--sp-5`; Brief padding `--sp-5` on all sides; inside a card every internal rule is `--sp-3` margin + `--sp-3` padding; the terms box `--sp-3` margin.
3. **Safe zone.** Fix the specificity so the wide tile keeps its right padding on hover devices; bring the zone onto the grid at 72px; scale the peek rig to 64px on half tiles so their text column keeps about 190px.
4. **Takeover and feed.** `.takeover { padding-bottom: var(--sp-6) }`; a real rule above each feed section label (`--border-strong`, or the chosen direction's pixel row).
5. **Grid the strays.** 6px gaps → 8px; `5px` radii → `--radius-sm`; 76 → 72; the 2px nameplate pad becomes 4px with the new chip.
6. **Law.** Add `--maxw-glance`, the four signature pairs with their ratios, and the corrected bento-width sentence to SKILL.md.

## Part 3 — What the fusion means here

- The Laboratory's rule set, translated: ink and paper carry 90% of every screen; one hue spent on tiny, exact marks; metadata small and quiet; one shadow or none; pixels as the house texture (`personal3/frontend/DESIGN.md`, `GridBanner.tsx`, `PixelImage`).
- Design vault: one accent spent in one place (`color.md` §3); whitespace is a material (`layout.md` §3); grids want one violation (§5); texture as an accent system, not a costume (§10); structural devices must encode something true (`components.md` §4).
- Ali's rulings: the tech layer is RoboBuddy's pixel language only; cells live on paper (no dark housings at rest beyond the heart and the cover); tokens plus derived tints, no new hues; the highlight is `#F78D1D`.

The three directions in the lab are three ways to spend the same palette through that language: **A Registration marks** (the pixel as the ink's unit; glyphs, cell rows, stepped corners), **B One hue per station** (monochrome chrome, one hue per view, colour as the station signal), **C Halftone** (ordered dither as the texture that carries tint into paper).
