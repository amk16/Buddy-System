# DESIGN.md — AI Marketing Pulse (the Buddy-System)

The canonical, enforced design system lives in
`.claude/skills/buddy-system/SKILL.md` and is implemented in
`frontend/src/index.css`. This file is the at-a-glance summary for impeccable; when the
two disagree, the SKILL.md tokens win and must be kept in sync with the CSS.

## Register & feel

Product register with an editorial lean. Light, always: warm paper, never dark. The
physical scene: Kajol reading on a bright screen in a two-minute gap between calls,
wanting it to feel small and finishable. Theme is light because the product is a paper
broadsheet, not a control room.

## Color (OKLCH-minded, warm-tinted neutrals; strategy: Restrained + one gold accent)

Surfaces (warm paper):
- `--paper` #faf7f0 (page), `--card` #fffdf8 (cards), `--cream-2` #f3eee2 (recessed
  panels), `--brief-bg` #fdf3cd (butter Brief surface).
- `--border` #e7e0d2 (hairlines), `--border-strong` #d8cfba (section rules).

Ink & accent (Highlighter & Ink):
- `--ink` #2c2a26 (primary), `--ink-soft` #5f594e (secondary).
- `--accent` #6e530e deep brand gold (links, markers), `--accent-deep` #574108
  (hover/active).
- `--brand-yellow` #ffd700 — **decoration/surface only, NEVER text.**

Signal tints (quiet pills, tinted bg + same-hue dark text): trending (terracotta),
new (green), shift (gold). Section "signature" colors are assigned per section for the
bento tiles and takeover wash (`lib/signature.ts`).

**Contrast law:** WCAG AA floor 4.5:1; every shipped pair is documented and passes (see
SKILL.md table; min shipped ≈5.2:1). Compute any new pair before shipping.

## Typography (exactly two families, never a third)

- **Fraunces** (variable serif): masthead, section labels, headlines, summaries,
  why-it-matters. `font-variation-settings: "SOFT" 60, "WONK" 0`. Headlines 560–600,
  body 400.
- **Source Sans 3** (variable sans): pills, meta, glossary, switcher, reading-time chip,
  buttons. 400–600; `letter-spacing: 0.05em` only on xs pills/kickers.
- Scale: `--fs-xs` .75 / `--fs-sm` .875 / `--fs-body` 1.0625 / `--fs-md` 1.1875 /
  `--fs-lg` 1.4375rem / `--fs-xl` clamp(1.75, 6vw, 2.375) masthead only. Body
  line-height 1.65, headlines 1.3. Reading measure capped (`max-inline-size: 62ch` on
  summaries).

## Layout & spacing

- 4px scale (`--sp-1`..`--sp-8`). Reading views (section, feed) are a single centered
  720px column (`--maxw`). The glance bento widens to 1040px (`--maxw-glance`) and is
  the *only* sanctioned grid.
- Card anatomy: kicker pill → headline (the source link) → why-it-matters → meta row
  (source · date · Details toggle) → [expanded: summary → terms glossary].
- `--radius` 10px / `--radius-sm` 6px.

## Elevation

Two soft, warm-tinted shadows only: `--shadow-card` at rest, `--shadow-card-hover` on
hover. No hard shadows, no glass, no heavy elevation. Depth is suggestion, not drama.

## Motion (state feedback only, never decoration)

- Exactly two tokens: `--motion-md` 250ms, `--ease-settle` cubic-bezier(.2,0,0,1)
  (settles, never bounces).
- View changes morph via the native View Transitions API; reduced-motion collapses to
  an instant swap, enforced in JS and CSS. Nothing animates at rest.
- Sanctioned moving exceptions, tightly bounded: the one-time masthead typewriter
  greeting, and the `BuddyPeek` tile-hover mascot (hover-capable devices only,
  off-frame at rest, ≤300ms, never covers text, `aria-hidden`).

## The three views

- **Glance** (default) — bento front door: Brief tall left, signature section tiles
  right, "Read everything" tile, buddy corner.
- **Section** — fill-screen takeover washed in the section's signature tint; cards read
  in the calm 720px column; back link + "Read everything instead".
- **Feed** — classic continuous Brief + every section.

## Components

Brief (always open, never disclosed), ItemCard (collapsed by default, opt-in detail),
SectionTile (one button per section), ArchiveSwitcher (native `<select>`, restyled),
BuddyDialog / BuddyCorner / BuddyPeek (the mascot surfaces), reading-time chip.

## Accessibility floor (non-negotiable)

Contrast ≥4.5:1; `:focus-visible` 2px gold outline on every interactive element;
`prefers-reduced-motion` collapses all motion; disclosure fully keyboard-operable; hit
targets ≥40px.

## Hard NOs

Dark backgrounds; neon / AI-purple / gradient washes; alarmist red; dense collapsed
cards; >2 typefaces; emoji in pills/buttons/headings; decorative animation; anything
implying a task, deadline, count, or backlog.
