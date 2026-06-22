# Peeping RoboBuddy — design spec

**Date:** 2026-06-22 · **Branch:** highlighter-ink · **Status:** approved, ready for implementation plan

## Context

The four bento tiles on the glance view (Tools / News / Case Studies / People) are
functional but static. Goal: make them feel **welcoming and un-intimidating** with a
cute-yet-cool robot creature that **peeks in from the right edge of a tile on hover**,
with a **story across the four boxes** so they feel unified yet distinct.

The creature is the project's existing mascot, **RoboBuddy** (`frontend/public/robobuddy.png`,
already in the masthead). We reuse his identity — cream segmented body, multicolor
**pixel-screen face**, gripper claws, antenna — rebuilt as a small **inline SVG** so he
scales crisply and tints per section. Direction was validated by live browser
prototyping (mockups archived under `.superpowers/brainstorm/`).

## Design principles honored

- **Native CSS + inline SVG only** — no animation library (matches house style; SVG is
  the right tool for small UI character work).
- **State-feedback motion only** — hover/focus-triggered, ≤300ms, easing
  `cubic-bezier(0.2,0,0,1)` (settle, never bouncy), **no looping**, honors
  `prefers-reduced-motion`.
- **Peek = masking** — a whole buddy lives off the tile's right edge; `overflow:hidden`
  on the tile crops him; hover slides him in. Never draw a partial figure.
- **Unity + change** — one rig + one motion grammar (unity); per-box emotion, palette,
  prop, all entering from the right (change/story).

## The character rig (one reusable inline SVG)

ViewBox `0 0 120 150`. Group structure (each animatable part its own `<g>`):

- **`prop`** (per-box, drawn behind head) — see props below.
- **`head`** group containing:
  - two **gripper mitts** (cream, `fill:url(#cream)`, `stroke:#cabf9f`) at the bottom rim.
  - **head** ellipse `cx60 cy58 rx50 ry47`, `fill:url(#cream)` (linear `#f8f2e5`→`#e6dcc5`),
    `stroke:#cabf9f` 1.8.
  - **sheen** highlight ellipse `cx48 cy38 rx30 ry20`, `fill:url(#sheen)` (radial white,
    .9→0 opacity).
  - **antenna**: path `M52 13 q-3 -9 1 -13` stroke `#b9ad8c`; tip `circle cx53 cy0.5 r4.2`
    filled with the section **`--sig`** color.
  - **visor brow**: `path M26 40 q34 -10 68 0` stroke `#d6c9ab`.
  - **screen**: `rect x24 y42 w72 h46 rx15 fill #17150f` + inner `rect x26 y44 w68 h42 rx13
    fill #0f0d09`.
  - **pixel face**: an 11×7 grid (see below).

Gradients are per-instance (`id` suffixed by section id) to avoid collisions when four
buddies render on one page.

### Pixel face — 11 cols × 7 rows

Grid constants: `CELL=4.6, GAP=1.2, X0=29, Y0=46, pitch=5.8`. Render **all 77 cells** as
dim off-pixels (`fill #221d17`), then overlay the **lit** cells (eyes ∪ mouth) cycling
the section palette. `rx=1` on every cell (chunky but slightly soft).

**Lit-cell maps** `[col,row]` (the four locked emotions):

```
tools  (eager):     eyes ‿ ‿  [[1,1],[2,2],[3,2],[4,1],[6,1],[7,2],[8,2],[9,1]]
                    mouth open [[3,4],[7,4],[3,5],[4,5],[5,5],[6,5],[7,5]]
news   (surprised): eyes ◌ ◌  [[1,2],[2,1],[3,2],[2,3],[7,2],[8,1],[9,2],[8,3]]
                    mouth O    [[4,4],[5,4],[6,4],[4,5],[6,5],[4,6],[5,6],[6,6]]
case   (cool):      shades     [[1,2],[2,2],[3,2],[1,3],[2,3],[3,3],[5,2],[7,2],[8,2],[9,2],[7,3],[8,3],[9,3]]
                    smile      [[3,5],[4,6],[5,6],[6,6],[7,5]]
people (proud):     eyes ^ ^  [[1,2],[2,1],[3,2],[7,2],[8,1],[9,2]]
                    grin       [[3,4],[7,4],[3,5],[4,5],[5,5],[6,5],[7,5],[4,6],[5,6],[6,6]]
```

**Per-section palette** (harmonious within each hue family — multicolor like the source
screen, but biased to the section color):

```
tools:  ["#ffd24a","#f6b53d","#e8a33a","#ffc24a","#d99a2e"]   amber / gold
news:   ["#e9744a","#f0905c","#d6552f","#ef9b6a","#c9572f"]   terracotta / coral
case:   ["#3fae6b","#2bb6a6","#7ed957","#36c98a","#1f9e6e"]   green / teal
people: ["#5b8fd6","#7fb0e0","#a05ec9","#3a7bd5","#b98ad9"]   blue / periwinkle / violet
```

### Props (per box, in the section `--sig` color)

- **tools** — wrench: `<g transform="rotate(28 22 104)"><rect x18 y96 w6 h20 rx3/><path d="M21 92 a7 7 0 1 0 0 9 l0 -4 a3 3 0 1 1 0 -1 z"/></g>`
- **news** — "!" spark: `<rect x98 y20 w6 h14 rx3/><circle cx101 cy40 r3.4/>`
- **case** — results chip with up-arrow: `<rect x6 y98 w20 h14 rx4/>` + white `M16 110 l0 -8 M12 106 l4 -4 l4 4`
- **people** — heart: `<path d="M101 98 c-4 -5 -12 -1 -8 5 c2 4 8 7 8 7 c0 0 6 -3 8 -7 c4 -6 -4 -10 -8 -5 z"/>`

## Motion (all four identical — the unity grammar)

Buddy lives at the tile's right edge, **fully off-frame at rest**, leaning in on hover/focus:

```css
.tile-buddy {                 /* wrapper inside the tile button */
  position: absolute; top: 12%; right: 0; width: 108px; height: 148px;
  transform-origin: bottom right;
  transform: translateX(118%) rotate(8deg);          /* hidden, cropped by overflow */
  transition: transform 300ms var(--ease-settle);
  pointer-events: none;
}
.tile:hover .tile-buddy,
.tile:focus-within .tile-buddy { transform: translateX(13%) rotate(6deg); }

.tile:hover .head,
.tile:focus-within .head { animation: buddy-tilt 620ms var(--ease-settle); transform-origin: 60px 102px; }
@keyframes buddy-tilt { 0%{transform:rotate(6deg)} 55%{transform:rotate(-3deg)} 100%{transform:rotate(0)} }

@media (prefers-reduced-motion: reduce) {
  .tile-buddy { transition: none; transform: translateX(118%) rotate(8deg); } /* still hidden idle */
  .tile:hover .tile-buddy, .tile:focus-within .tile-buddy { transform: translateX(13%) rotate(6deg); } /* instant */
  .head { animation: none !important; }
}
```

`:focus-within` ⇒ keyboard users tabbing to a tile get the same reveal. Buddy is
**decorative**: wrapper `aria-hidden="true"` + `pointer-events:none`.

## Files to change

1. **`frontend/src/lib/buddy.ts`** (new) — exports the rig data: `FACE` (lit-cell maps),
   `PALETTE`, and `PROP` markup keyed by section id (`tools|news|case_studies|people`),
   plus a `buildPixelFace(sectionId)` helper returning the `<rect>` list. Keep the four
   emotion maps + palettes here as the single source of truth.
2. **`frontend/src/components/BuddyPeek.tsx`** (new) — `({ sectionId, accent }) => JSX`.
   Renders the inline `<svg>` rig (gradients id-suffixed by `sectionId`), pulls
   face/palette/prop from `buddy.ts`, antenna-tip + prop filled with `accent`. Returns
   `null` for unknown ids (graceful — no buddy rather than a broken one).
3. **`frontend/src/components/SectionTile.tsx`** — render
   `<span className="tile-buddy" aria-hidden="true"><BuddyPeek sectionId={section.id} accent={signature.accent} /></span>`
   as the last child of the `<button>`.
4. **`frontend/src/index.css`** — add `position: relative; overflow: hidden;` to `.tile`
   (≈ line 367), then the `.tile-buddy` block + `@keyframes buddy-tilt` + reduced-motion
   rules above. Reuse `--ease-settle`; 300ms is intentionally just over `--motion-md`
   (250ms) for the longer travel — acceptable per house rules (≤300ms).

## Risks / watch-items

- **Takeover morph interaction** — the tile has `viewTransitionName` and grows to full
  screen on click. Verify the absolutely-positioned buddy doesn't get captured oddly
  during the morph; if it does, add `view-transition-name: none` / hide `.tile-buddy`
  while a takeover is animating. Buddy is `aria-hidden` so it's out of the a11y tree.
- **`overflow:hidden` on `.tile`** — confirm it doesn't clip the existing `::before`
  Scribbld DNA bar (it sits at top inside padding, so fine) or focus rings (the button's
  own outline should still render; check on keyboard focus).
- **Headline overlap** — headlines are `max-width:56–60%` on the left; buddy enters from
  the right at `translateX(13%)`. Confirm no overlap at the narrowest bento column.

## Verification

`cd frontend && npm run dev`. For each of the four tiles:
1. At rest, **no buddy visible** anywhere (fully off-frame).
2. On hover, the correct buddy leans in **from the right**, tilts, and settles — gold
   eager / terracotta surprised / green cool-shades / slate proud, each with its prop.
3. Tab to a tile ⇒ same reveal via `:focus-within`.
4. With OS "reduce motion" on ⇒ buddy still hidden at rest, appears instantly on
   hover/focus, no tilt animation.
5. Click a tile ⇒ takeover morph still works; buddy doesn't glitch the transition.
Then run the `buddy-system` and `pulse-design-review` skills before claiming done.
