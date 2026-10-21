---
name: buddy-system
description: Use when writing or changing any UI in the AI Marketing Pulse frontend — components, CSS, layout, microcopy, or visual decisions of any size.
---

# The Buddy System — the AI Marketing Pulse design system

Mascot: **RoboBuddy** (`frontend/public/robobuddy.png`) — a companion, never a
narrator. The system's promise: Kajol is never alone with a wall of
information, and nothing ever gets between her and reading her own way.

## The Reader

Every pixel serves one person: **Kajol Bheda** — Scribbld CEO becoming an AI
consultant. Sharp marketer's eye, high intelligence, real creativity — tangled
with anxiety and boundless thoughts. She opens this feed in tight gaps between
client calls.

**Operational consequence:** the page must never feel like a to-do list or an
unread-count. First glance must say *"this is small, warm, and finishable."*
Depth exists but is opt-in. Nothing urgent, nothing blinking, nothing red.
Technical content is welcome; intimidating presentation of it is not.

## Design tokens (canonical — copy exactly, never improvise values)

```css
:root {
  /* surfaces (warm paper) */
  --paper: #faf7f0;        /* page background — warm ivory */
  --card: #fffdf8;         /* item cards — cream */
  --cream-2: #f3eee2;      /* recessed panels: terms glossary, select, code */
  --brief-bg: color-mix(in srgb, #f78d1d 10%, #faf7f0); /* the Brief's ground: the highlight at a tenth into paper (= #faecdb) */
  --border: #e7e0d2;       /* hairlines */
  --border-strong: #d8cfba;/* section rules */

  /* ink — Scribbld "Highlighter & Ink" brand layer */
  --ink: #2c2a26;          /* primary text */
  --ink-soft: #5f594e;     /* secondary text */
  --accent: #6e530e;       /* deep brand gold — links, markers (6.8:1 on paper) */
  --accent-deep: #574108;  /* hover/active gold */
  --brand-highlight: #f78d1d; /* Scribbld's highlight (corrected 2026-10-21): decoration, surfaces, ink text ON it */

  /* signal tints (quiet pills: tinted bg + same-hue dark text) */
  --tag-trending-bg: #f7e8df;  --tag-trending-fg: #8f4524;
  --tag-new-bg: #e4efe9;       --tag-new-fg: #1f6e5c;
  --tag-shift-bg: #f5ecd6;     --tag-shift-fg: #6e530e;

  /* type */
  --font-serif: "Fraunces", "Iowan Old Style", Georgia, serif;
  --font-sans: "Source Sans 3", ui-sans-serif, system-ui, sans-serif;
  --fs-xs: 0.75rem;     --fs-sm: 0.875rem;   --fs-body: 1.0625rem;
  --fs-md: 1.1875rem;   --fs-lg: 1.4375rem;
  --fs-xl: clamp(1.75rem, 6vw, 2.375rem);
  --lh-body: 1.65;      --lh-tight: 1.3;

  /* spacing (4px base) */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
  --sp-5: 24px; --sp-6: 32px; --sp-7: 48px; --sp-8: 64px;

  /* shape & depth */
  --radius: 10px;  --radius-sm: 6px;
  --shadow-card: 0 1px 2px rgba(76,60,35,.06), 0 3px 10px rgba(76,60,35,.05);
  --shadow-card-hover: 0 2px 4px rgba(76,60,35,.08), 0 6px 18px rgba(76,60,35,.07);
  --maxw: 720px;

  /* motion: state feedback only, never decoration */
  --motion-md: 250ms;
  --ease-settle: cubic-bezier(0.2, 0, 0, 1);
}
```

### Contrast table (WCAG AA floor is 4.5:1 — every shipped pair must pass)

| Pair | Ratio |
|---|---|
| `--ink` on `--paper` | 13.4:1 |
| `--ink` on `--card` | 14.1:1 |
| `--ink-soft` on `--paper` | 6.5:1 |
| `--ink-soft` on `--card` | 6.8:1 |
| `--accent` on `--paper` | 6.8:1 |
| `--accent` on `--card` | 7.1:1 |
| `--accent` on `--brief-bg` (#faecdb) | 6.2:1 |
| `--ink` on `--brand-highlight` (the nameplate chip) | 6.0:1 |
| `--ink-soft` on `--brief-bg` (#faecdb) | 6.0:1 |
| `--tag-trending-fg` on its bg | 5.8:1 |
| `--tag-new-fg` on its bg | 5.2:1 |
| `--tag-shift-fg` on its bg | 6.1:1 |
| `--ink-soft` on `--cream-2` (unlit reason chip) | 6.0:1 |
| `--accent` on `--cream-2` (pressed reason chip, with its 1px `--accent` inset edge and weight 600) | 6.2:1 |

When introducing ANY new color pair, compute its ratio first; below 4.5:1 it
does not ship.

### Non-text decoration (exempt from the 4.5:1 floor)

These values are painted as shapes, never as text or as the only carrier of
meaning, so the text contrast floor does not apply. Nothing outside this table
may claim the exemption.

| Where | Value | Ratio on `--card` | Role |
|---|---|---|---|
| `.mark-cell` at rest (all 27) | `#938d7e` | **3.25:1** | the heart, unlit |
| `.mark-cell` on hover, at rest only | `--ink-soft` #5f594e | 6.8:1 | the control answering the pointer |
| `.mark-cell`, level `more` (the whole heart) | `#1f9e6e` | 3.0:1 | like. The `case_studies` signature green from `lib/buddy.ts`, reused as the "liked" colour |
| `.mark-cell`, level `loved`, body | `#f6b53d` | 1.8:1 | super like, the glow |
| `.mark-cell`, level `loved`, core (1,1) (2,1) (3,1) (1,2) (3,2) | `--brand-highlight` #f78d1d | 2.3:1 | the highlight, decoration only |
| `.mark-cell`, level `loved`, tip (3,5) | `--accent` #6e530e | 7.1:1 | the point that holds the shape |
| `.mark-halo`, level `loved` only | `--accent` #6e530e, 1px, on whole pixels | 7.1:1 | the silhouette edge, the non-hue tell. It only ever fades, never moves |
| `.mark-rig`, level `loved` only | a bigger rig: 4px cells with **2px** gaps, 40x34 ink | n/a | super like sits a size larger. **No transform**: a scaled rig resampled the outline soft and pushed the ink into the mobile gutter |
| `.mark-shimmer` | `--brand-highlight` #f78d1d at 35%, an SVG gradient clipped to the 27 cells | n/a | the one-shot diagonal sweep. Never painted outside the cells |
| `.mark-ring` | `--accent` at 0.55 -> 0 alpha | n/a | the one-shot landing halo |
| highlight sliver under ink rules | `--brand-highlight` #f78d1d | n/a | Scribbld banner DNA |
| `.tile-sig` on **hover/focus only**: the label, the sliver's lower half, a 3px inset left edge | `--sig` (the section's accent; ≥4.5:1 on card as text) | n/a | the hue appears on reach, in three places that read as one: "you are about to change station" |
| `.takeover .section-label::before` | the sliver, 64px wide, ink over `--sig` in its lower half | n/a | the section's hue spent once, above its label, never a wash |
| `.section + .section` | `--ink` at 50%, 8px cells on a 12px pitch, 3px tall | n/a | register tape between feed sections |
| `.brief` ground | `--brand-highlight` at 10% into `--paper` (`--brief-bg`) | n/a | the one tinted surface on the front door |
| `.boot-screen` housing | `#17150f` outer, `#0f0d09` inner | n/a | the cover's screen, BuddyPeek's own housing values at viewport scale |
| `.boot-cell` at rest, on `#0f0d09` | `#221d17` | n/a | the unlit pixel, the face's own dim value |
| `.boot-cell` during the raster sweep | `#4a3f2a` | n/a | the self-test's dim pass, one dwell per cell |
| `.boot-cell` lit, noise | the `tools` palette `#ffd24a` `#f6b53d` `#e8a33a` `#ffc24a` `#d99a2e` | n/a | the screen searching, in BuddyPeek's amber |
| `.boot-cell` lit, the pencil | body in three bands from the point end, `--brand-highlight` #f78d1d → `#faa733` → `#ffc24a`; cone `--brand-highlight`; the lead and the written cell `#938d7e` (the heart's resting grey: on the screen's dark, graphite must be light to read); the gap unlit | n/a | the Scribbld pencil, traced from the agency's logo, in the system's own values |
| `.boot-grain` | SVG fractal noise at 6% soft-light | n/a | the printed-sheet texture, cover only; soft-light so the sheet's tone matches the page at the lift |

**The resting value carries a floor of its own.** At rest the cells are the
control's only visual carrier, so they answer to WCAG 1.4.11 (3:1 for
non-text), not to the decoration exemption. `#938d7e` clears it on both
surfaces (3.25:1 on `--card`, 3.09:1 on `--paper`) and nothing dimmer may
replace it.

The lit values sit below that floor and are allowed to, because by then the
control is established: the shape is already on the card, the level is in the
`aria-label`, and the cells are never the only thing that changed.

**The ladder is green then gold.** Deep gold was tried for `more` and read as
brown-grey beside the resting grey; the two stages now differ in hue as well as
in brightness, which is what makes a raise visible at a glance.

**What separates the three states, honestly.** Colour alone does not carry
them, and the earlier claim that nothing here is colour-only was false:
`#938d7e` against a lit amber is close in lightness, which is exactly the case
a greyscale or colour-blind reading exposes.

| Pair | What differs besides hue |
|---|---|
| none vs like | lightness (#938d7e to `#1f9e6e`) and hue, grey to green |
| none vs super like | lightness, plus the 1px `--accent` silhouette edge and the larger rig it is drawn at, neither of which exists at any other level |
| like vs super like | hue (green to gold), the edge, and the size |

On top of that the shape is already on the card before anything lights, each
raise animates in its own way (a row sweep and one beat, then a diagonal fill
with a shimmer, a halo and a double beat), and the level is always spoken by the
`aria-label`.

### Brand provenance — Scribbld "Highlighter & Ink"

Kajol's agency Scribbld brands in its highlight orange (#F78D1D, corrected
2026-10-21 from the marker yellow the system first carried) + black. The
buddy-system carries that as an accent language, never a repaint:

- `--brand-highlight` (#F78D1D) is **decoration/surface only — NEVER text**
  (2.2:1 on paper). Legal uses: link underlines (the "highlighter" motif),
  the sliver under ink rules (tiles, section labels — Scribbld's banner DNA
  miniaturized), the super-like heart's core and shimmer, the Brief's ground
  at a tenth into paper (`--brief-bg`), and the nameplate chip, where **ink
  is the text and the highlight is the surface** (5.9:1). `--brand-yellow`
  is retired.
- `--accent` is the deep brand gold for link text and markers; terracotta is
  retired.
- Full-yellow floods and black bands stay on Scribbld's own properties; the
  reading surface stays warm paper.

## Typography

Exactly **two** families. Never add a third typeface.

| Family | Role | Settings |
|---|---|---|
| Fraunces (variable serif) | masthead, section labels, headlines, summaries, why-it-matters | `font-variation-settings: "SOFT" 60, "WONK" 0;` headlines weight 560–600, body weight 400 |
| Source Sans 3 (variable sans) | pills, meta lines, terms glossary, switcher, reading-time chip, buttons | weight 400–600, `letter-spacing: 0.05em` only on xs pills/kickers |

Type scale: `--fs-xs` pills/kickers · `--fs-sm` meta/terms/UI · `--fs-body`
summaries and why-it-matters · `--fs-md` card headlines · `--fs-lg` section
labels · `--fs-xl` masthead only. Body line-height `--lh-body` (1.65);
headlines `--lh-tight` (1.3).

## View states (the buddy-system's three surfaces)

The URL hash is the single source of truth; all view changes go through
`withViewTransition` in `frontend/src/lib/transition.ts`.

- **Glance** (default, `""`/`#glance`) — the bento front door: Brief panel,
  one tile per non-empty section, the "Read everything" tile, the buddy
  corner. A reserved full-width slot directly under the Brief is held for the
  future daily-Report tile.
- **Section** (`#<sectionId>`) — one section's full card list, a back link to
  the glance, and a quiet "Read everything instead" link at the bottom.
- **Feed** (`#feed`) — the classic continuous layout: Brief + every section.

**Bento never gates content**: the full feed is always exactly one tap away,
and no reading mode may constrain how she moves through an issue.

## Motion

- Exactly two motion tokens: `--motion-md` (250ms) and `--ease-settle`.
- View changes morph via the native View Transitions API
  (`document.startViewTransition`); tiles carry `view-transition-name:
  pulse-sec-<id>` in glance view, section headings carry the same name in
  single-section view, the Brief carries `pulse-brief` always.
- Reduced motion = instant swap, enforced in BOTH the JS wrapper and a CSS
  `::view-transition-*` override. Unsupporting browsers get an instant swap.
- Motion is state feedback only — nothing animates at rest.
- **Exactly four sanctioned exceptions, numbered here and nowhere else:**
  1. the one-time masthead typewriter greeting,
  2. the `BuddyPeek` tile-peek,
  3. the `ReactionMarks` landing, which is one exception covering its three
     one-shot motions (the ring, the shimmer and the heartbeat),
  4. the `BootCover`, the once-per-page-load intro in which RoboBuddy's own
     screen boots on the paper and draws the Scribbld pencil, then the sheet
     lifts off the top.
  `DESIGN.md` and the comments in `index.css` follow this numbering.

## Mascot — RoboBuddy hard rules

The **masthead** RoboBuddy is strictly **ambient**. It sits still at the top of
the centered masthead, above the app title ("Buddy-System"), on every view. Its
one interactive offer is the optional "pick up where you left off" chip in the
glance grid's buddy corner (localStorage, one entry, per-issue). The masthead
buddy may NEVER: animate, block content, auto-navigate, speak/instruct, show
progress, or appear modal. The resume chip disappears permanently once used or
dismissed, and never exists when there's nothing to resume.

The one carve-out is the **boot cover** (exception 4 of 4, below): RoboBuddy's
own pixel screen, drawn large, boots on the paper for about two seconds before
the first issue appears, then the sheet lifts away. The masthead portrait
beneath is never part of it and is at rest from its first frame. The cover
never recurs within a page load.

### Sanctioned exception 2 of 4 — the bento tile-peek (`BuddyPeek`)

The same RoboBuddy may **peek into a glance bento tile on hover/focus** — a
small inline-SVG version that leans in from the tile's right edge, one pixel
emotion per section (the four-box story: eager / surprised / cool / proud).
This is the ONE place the buddy is allowed to move, and it is bounded by hard
rules so it stays a companion, not a distraction:

- **Hidden at rest** — fully off-frame (`overflow: hidden` crops it); idle tiles
  are calm and empty. It only appears on `:hover` / `:focus-within`.
- **Never covers text** — tiles reserve a right safe-zone (`padding-right`); the
  buddy peeks only into that empty gutter. Reading is never impeded.
- **State feedback, not decoration** — triggered by the pointer/keyboard, ≤300ms,
  `--ease-settle` (settles, never bounces), and it does NOT loop.
- **Honors `prefers-reduced-motion`** — stays hidden at rest, appears instantly
  on hover/focus with no slide or tilt.
- **Decorative only** — `aria-hidden`, `pointer-events: none`; never in the a11y
  tree, never gates or replaces content.

Source: `components/BuddyPeek.tsx` + `lib/buddy.ts` (face/palette data),
styled in `index.css` (`.tile-buddy`). Anything outside these bounds is still a
violation.

### Sanctioned exception 3 of 4: the reaction-mark landing (`ReactionMarks`)

Reaching **super like** plays three one-shot motions, the moment's only reward:
a diagonal shimmer across the heart, an expanding halo behind it, and a double
beat of the heart itself. Reaching `more` plays only the single heartbeat. The three motions are ONE exception, the
third, and it is bounded exactly as tightly as BuddyPeek:

- **Tap-triggered only.** They exist because she just raised the card to the
  top. None is ever set from restored state, so a reopened card is silent.
- **One shot each, and short.** The **ring** expands scale 1 -> 1.6 on
  `--ease-settle` (1.4 below 480px, so it stays inside the card's padding) and
  fades 0.55 -> 0 on a linear curve over 400ms, so it still has body at the
  midpoint instead of being gone by 120ms. The **shimmer** is a
  diagonal `--brand-highlight` band at 35% alpha crossing the heart once over
  **500ms**, the longest motion the system permits and only because it is the
  answer to a deliberate tap. The **heartbeat** scales the rig on `--ease-settle`,
  once: one pulse (1 -> 1.15 -> 1, **300ms**) at like, two
  (1 -> 1.18 -> 1.05 -> 1.18 -> 1, **450ms**) at super like. Both end where they
  began, because neither carries a fill mode and the size difference between the
  levels is drawn rather than held by a transform; a beat that ended anywhere
  else would snap back the moment it finished. They are the only sanctioned
  transforms on a control. The ring and the shimmer unmount on `animationend`; the beat clears
  its own attribute on the same event. None of the three loops or repeats. The
  shimmer and the beat may replay together, when she taps a heart already at the
  top, because a control that does nothing reads as broken; the ring never
  replays. The linear fade is the one sanctioned use of a curve outside
  `--ease-settle`, on opacity only.
- **Honors `prefers-reduced-motion`.** The JS guard skips the ring entirely,
  so the span is never mounted and there is nothing waiting for an
  `animationend` that would never fire. The base `opacity: 0` is the second
  belt: even if a ring did mount, `animation: none` would leave it invisible.
- **Decorative only.** The two overlays are `aria-hidden` with
  `pointer-events: none`, and the beat is a transform on an `aria-hidden` rig.
  The landing that actually carries meaning is the heart's own change plus the
  "noted" word and the `role="status"` announcement.
- **Nothing animates at rest.** An untouched card, and a card restored from
  storage, are both completely still.

The staggered cell lighting is not an exception: it is the state change itself,
45ms per row on like and 30ms per diagonal on super like, each cell's own fill
still one `--motion-md`. The delay lives on the raised levels only, so clearing
a card drops every cell back together. The hold cue is likewise state feedback,
a 350ms fade toward rest that shows a gesture in progress.

Source: `components/ReactionMarks.tsx` + `components/PixelScreen.tsx` (the
`PixelHeart` rig) + `lib/useHoldToClear.ts` + `lib/reactions.ts`, styled in
`index.css` (`.mark`, `.mark-rig`, `.mark-cell`, `.mark-shimmer`,
`.mark-ring`).

### Sanctioned exception 4 of 4: the boot cover (`BootCover`, "Self-test")

Once per page load, before the first issue is on screen, RoboBuddy's own
screen stands alone on the paper. It is the screen BuddyPeek wears on the
tiles (`lib/buddy.ts` housing), drawn at viewport scale with its grid at three
times the face's resolution (33x21 cells of 1.5 on a 1.93 pitch, the same
63x40 footprint), and it boots like a machine: a dim raster (`#4a3f2a`)
sweeps every cell once, the screen searches in noise (sixty cells a frame in
the `tools` amber palette, ten frames), then the **Scribbld pencil**
(`lib/pencil.ts`) resolves from its point outward at 7ms a cell, and the point
writes one ink cell. The pencil is traced from the agency's original logo
(the 500px transparent PNG on wearescribbld.com, measured 2026-10-22): it
leans 53.9 degrees with its point at bottom-left, its body is 0.235 of its
length wide, and from the point it is graphite, an orange cone, a thin unlit
gap across the body, then the body to a flat end with rounded corners, in one
orange that lightens toward the flat end (`--brand-highlight` → `#faa733` →
`#ffc24a`). It is rasterised by area coverage (a cell lights at ≥45% inside)
so the shape, not a sample, decides each cell.
A serif readout counts `000` to `099` in the top-left corner on a
timer and reads `100` only as the sheet lifts, a sans tabular stamp (the
issue's own date and its reading-time line, never a count) sits top-right once
the issue is in, and the wordmark "Buddy-System" sits viewport-wide at the
bottom edge, cut by the paper's edge, its letters rising once in a stagger.
The readout label and the stamp use the nameplate's `0.08em` tracking in
`--fs-xs` Source Sans; the count is Fraunces at `clamp(44px, 4.5vw, 60px)`, a
cover-only size. When the first issue is ready and the cover
has held for `MIN_HOLD` (the whole self-test plus a breath, about 5.5s, `lib/boot.ts`),
the sheet lifts off the top of the screen in one 1100ms `--ease-settle` move
with the finished page still beneath it. It is the one place RoboBuddy may
hold the screen, and it is bounded as tightly as the other three:

- **Once, and only at boot.** The decision is taken when the app mounts and is
  never revisited: archive and engine switches keep the inline "Loading…"
  line. There is no replay.
- **A deliberate intro, not a progress report.** The readout runs on a timer,
  not on bytes or stages, and it carries no percent sign and no stages. If
  the network is slow the finished face holds, still, until the issue lands,
  and after `SLOW_AFTER` the cover shows its one quiet visible word,
  "Loading…", on a line reserved from mount so nothing moves. The
  `role="status"` text carries the meaning throughout.
- **One choreography, then one move.** The self-test plays once (about 2.2s)
  and the lift is a single translate on the sheet; the only other transform in
  the cover is the wordmark letters' one rise, also a translate. Never a
  scale. Nothing travels into the masthead: the page beneath is complete and
  still, and only the greeting types once the sheet clears.
- **Never in the way of recovery.** An empty index or a failed issue drops
  the cover at once, with no lift, so the retry copy is never held behind a
  mascot.
- **Holds the greeting.** `BuddyDialog` receives `paused` while the cover is
  up or lifting, so the typewriter (exception 1) starts only when the masthead
  is actually visible; nothing is typed unseen.
- **Honors `prefers-reduced-motion`.** The JS guard means the cover is never
  mounted at all (`shouldShowCover`). The global reduced-motion rule collapses
  every duration as the second belt, so even a mounted cover could not play.
- **Decorative only.** The screen, readout, stamp, wordmark and grain are all
  `aria-hidden`; the page beneath is `inert` until the cover is gone.
- **Evidence.** The design follows the targeted preloader sweep in the design
  vault (2026-10-21): progress at the frame and one subject in the centre,
  typographic instruments, the wordmark as landscape, exits of 500–900ms.

Source: `components/BootCover.tsx` + `lib/boot.ts` (the phase table and the
hold) + `lib/buddy.ts` (grid, `faceCells`, `facePalette`) + `lib/motion.ts`
(the shared reduced-motion guard), wired in `App.tsx` (`boot` state,
`data-boot`), styled in `index.css` (`.boot-cover`, `.boot-screen`,
`.boot-cell`, `.boot-readout`, `.boot-stamp`, `.boot-wordmark`, `.boot-grain`).

## Layout & spacing

- Reading views (section, feed): single centered column,
  `max-width: var(--maxw)` (720px) — one calm vertical river. The glance
  bento is the ONLY sanctioned grid; it and the takeover run at
  `--maxw-glance` (1040px, ruled 2026-10-21), with the takeover's cards still
  in the 720px column inside it. The glance's two columns need about 1024px
  (a half tile's text column must keep ~180px): below **900px** the glance is
  Brief-over-bento, and below 560 the bento is one column.
- Glance tiles: whole tile is one `<button>` named by its section label; the
  preview headline is plain text (real links live in the section view);
  *"…and more inside"* is the only permitted depth cue — numerals stay banned.
- 4px spacing scale. Conventions: padding inside cards `--sp-4`/`--sp-5`;
  gap between cards `--sp-4`; the glance's one rhythm is `--sp-5` (Brief to
  wall, and between tiles); gap between sections `--sp-6`/`--sp-7`; masthead
  breathing room `--sp-7` below. The masthead row is the portrait's 112px
  (92px below 560), never the image's aspect. The tile safe zone is 72px on
  hover devices and the hero keeps it. Inside a card every internal rule is
  `--sp-3` + `--sp-3`.
- **One hue per station (ruled 2026-10-21).** Chrome is monochrome: ink,
  paper, card, the sliver. The glance spends only the highlight (the Brief's
  ground and edge, the nameplate chip, underlines). A section's hue appears
  only on reach (tile hover/focus) and, in its takeover, once, in the lower
  half of the sliver above the label; the feed spends ink alone, with the
  ink/highlight sliver and register tape between sections. Nothing on the
  page is a wash of a hue.
- Card anatomy (top to bottom): kicker pill → headline → why-it-matters →
  meta row (source · date · Details toggle) → [expanded: summary → terms].

## Component conventions

- **Brief** — always fully visible; it IS the skim layer. Never put a
  disclosure inside the Brief. `--brief-bg` panel (the highlight at a tenth
  into paper) with a 3px `--brand-highlight` left edge: the one tinted
  surface on the front door.
- **ItemCard.** Collapsed by default: pill, headline (external link),
  why-it-matters, meta row. Expansion is a `<button>` with `aria-expanded` and
  `aria-controls`; expanded region holds summary + terms `<dl>`. A card with
  no summary AND no terms renders no toggle **unless a reaction has opened the
  Why row** (amendment, 2026-09-22): the chips are content, so they earn the
  toggle. Never auto-expand. The collapsed `.card-detail` carries `inert`, so a
  closed panel is out of the Tab order and out of the a11y tree.
- **ReactionMarks.** **One** pixel heart button (`.mark`) in the meta row's
  `.card-actions` group, on section cards only. Feedback has three states and
  one control: none, like, super like. A 40x40 `<button>` holding a 34x29 inline
  SVG (`aria-hidden`): a 7 wide by 6 tall heart, 27 cells, 4px cells, 1px gaps,
  `viewBox` 34x29, `shape-rendering: crispEdges`. Only the heart's own cells
  exist, so the shape is a recognisable object before it is a state. Fills and
  both stagger indices come from CSS keyed on `data-level` and `:nth-child`
  (`--r` row, `--d` diagonal), never from React `fill` attributes.
  **Like fills the whole heart** in `#1f9e6e`, sweeping one row down at a time
  (45ms per row), with one heartbeat. Half a heart was too quiet to read as an
  answer, and so was deep gold, which sits too near the resting grey. **Super
  like** warms every cell to `#f6b53d` on a 30ms diagonal, with the upper left
  lobe and the centre column in `--brand-highlight` and the tip in `--accent`,
  gains the silhouette outline, is drawn as a **bigger rig** (the same 27 cells
  at a 2px gap, 40x34 instead of 34x29, never a transform), and lands with a
  double heartbeat, a shimmer and a ring. A tap at the top replays the
  double beat and the shimmer, so the control always answers, and under reduced
  motion it still lands the word and the live region.
  **Tap climbs, hold clears.** A tap raises the level; a 500ms press and hold
  returns it to none, with the heart dimming from 150ms so an early release
  visibly snaps back; `Delete` or `Backspace` clears from the keyboard. The
  click the browser sends after a completed hold is swallowed. The gesture lives
  in `lib/useHoldToClear.ts`, and the button carries `touch-action`,
  `user-select` and `-webkit-touch-callout` guards.
  `aria-label` carries the level ("Like this" / "Like this, liked" / "Like this,
  super liked"), `aria-description` explains the gestures, there is **no
  `aria-pressed`** (three states are not a toggle) and **no `title`** (a long
  press on mobile Safari raises the title callout over the hold gesture). The
  hold cue runs **linear** from 150ms to 500ms so it arrives exactly when the
  clear commits: on `--ease-settle` it looked finished by 300ms and an early
  release read as a glitch. The silhouette edge fades on the same 350ms, so it
  leaves with the cells instead of surviving to the commit and vanishing in one
  frame. Beside
  the heart sits a fixed-width `.noted` slot that fades a quiet "noted" in and
  out for 1.2s so the row never shifts. It sits to the **left** of the heart, so
  the heart and the Details toggle cluster together; at <=480px the heart leads
  the group instead, so it is the ink and not the word that lands on the text
  river. Only the visual order changes, and the word is `aria-hidden`, so the
  tab order is untouched. A per-card visually hidden `role="status"` says
  "Noted" or "Cleared".
  **There is no dislike on the card.** The backend still accepts `less` and the
  resolver still understands it; nothing sends one.
- **ReasonChips.** The `Why` row at the bottom of an expanded
  `.card-detail-inner`, present only when the level is not none. A `<p>` label
  plus a `role="group"` of `aria-pressed` pills reusing the `.card-kicker`
  recipe. **The positive set only**, at both raised levels. `REASONS_NEGATIVE`
  stays exported for the API contract and the known-id filter but is never
  rendered. The 11 ids are
  fixed by `frontend/api/_lib/schema.ts`. Changing level clears the reasons.
  The chip shares one grouped rule with `.card-kicker` (family, size, tracking,
  line-height, `border-radius: 999px`) and diverges only where being a control
  forces it to: **40px tall with `--sp-3` horizontal padding**, against the
  kicker's 20px, because the hit-target floor outranks visual symmetry. A
  pressed chip keeps the same `--cream-2` fill and is distinguished by shape and
  weight: `box-shadow: inset 0 0 0 1px var(--accent)`, `--accent` ink, and
  weight 600 against the unlit 400. A tint here would have read as another
  signal pill, and the state must survive a greyscale or colour-blind reading.
- **Section labels** — JSON labels contain a leading emoji; strip it at render
  time, never show emoji in headings. A short ink/highlight gradient rule above
  the label does the anchoring instead.
- **ArchiveSwitcher** — stays a native `<select>` (keyboard/screen-reader free
  wins). Restyle only.
- **Reading-time chip** — lives under the masthead date, format
  `N min skim · M min full read`, sans, `--ink-soft`. Its job is reassurance:
  the depth is optional.

## Voice & copy

- Calm over clever. UI labels are one quiet word: "Details", "Hide", "Issue".
  The open Details toggle reads **"Hide"**, not "Less". It was renamed when the
  meta row still held a "Less like this" control and a screen-reader sweep would
  have read "Less, Less like this"; the dislike is gone, but "Hide" is the
  plainer word for what the button does and it stays.
- No exclamation marks anywhere in UI chrome.
- No urgency framing — "don't miss", "act now", "new!", unread badges and
  counts are all banned.
- Technical jargon in content is fine — that's what the terms glossary is for;
  never suppress it, never let it sit unglossed in UI copy we control.

## Accessibility floor (non-negotiable)

- Contrast ≥ 4.5:1 for all text (see token table — shipped pairs pass).
- `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
  on every interactive element.
- `prefers-reduced-motion: reduce` collapses all transitions/animations.
- Disclosure fully keyboard-operable (Tab → Enter/Space toggles).
- Hit targets ≥ 40px on touch.

## Anti-patterns — hard NOs

1. Dark backgrounds of any kind (no dark mode; this is a paper product).
2. Neon, "AI purple", or gradient washes.
3. Alarmist red anywhere — even error states use `--accent` deep gold.
4. Dense walls of text in a card's collapsed state.
5. More than 2 typefaces.
6. Emoji in pills, buttons, or headings.
7. Decorative animation (motion only as state feedback, ≤ 250ms, eased).
8. Anything implying a task, deadline, count, or backlog.

REQUIRED SUB-SKILL after any visual change: run `pulse-design-review`.
