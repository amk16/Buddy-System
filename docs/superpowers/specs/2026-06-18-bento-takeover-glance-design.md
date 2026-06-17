# Welcoming bento + fill-screen takeover — glance redesign

**Date:** 2026-06-18
**Surface:** AI Marketing Pulse frontend — the Glance ("at a glance") view
**Status:** Approved for planning

## Goal

Turn the landing (Glance) view into a more welcoming bento: the Brief lives on
the left, clear and easy to read; the section boxes fill the right in an
asymmetric arrangement, each carrying a signature color. Clicking a section box
animates it to fill the screen, revealing that section's content. All of it
stays inside the buddy-system theme (warm paper, deep-gold accent, marker-yellow
decoration, two typefaces, motion-as-state-feedback only).

The reader is Kajol — first glance must still feel "small, warm, finishable,"
never a task list. Depth stays opt-in. The full feed remains one tap away.

## The three decisions (made during brainstorming)

1. **Layout — asymmetric bento.** Brief tall on the left; section boxes vary in
   size on the right, first section as a wide hero.
2. **Color — tinted surface.** Each section box gets a low-saturation wash of
   its signature hue plus a colored left edge.
3. **Expand — full-screen takeover.** The clicked box morphs to cover the
   content area in its signature tint; cards read in a centered column; one
   "← At a glance" returns.

## Scope

### In scope
- Restyle/relayout the **Glance** view (`GlanceGrid` + `SectionTile` + CSS).
- Restyle the **Section** view into the full-screen tinted takeover.
- Introduce a per-section **signature color system** (tokens + assignment by
  section id).
- Widen the Glance canvas beyond 720px; keep reading/feed views at 720px.

### Out of scope (must stay untouched)
- The **Feed** view (`#feed`) — classic continuous layout, unchanged.
- **ItemCard** internals, progressive disclosure, terms glossary.
- The **Brief** component's internals (it is the skim layer; never a disclosure).
- **Masthead** / RoboBuddy, **ArchiveSwitcher**, reading-time chip.
- Hash routing, `withViewTransition`, reduced-motion handling.
- The backend / curation pipeline / JSON shape.

## Layout — Glance

- Glance widens to a ~1040px canvas (token, e.g. `--maxw-glance: 1040px`).
  **Reading (Section) and Feed views keep `--maxw: 720px`.** The wider canvas
  applies to the Glance grid only.
- Two columns: **Brief left (~42%)**, section bento right (~58%), `--sp-4` gap.
- **Brief is always-open reading content, NOT a click-to-expand box.** It keeps
  its butter `--brief-bg` panel + 3px `--accent` left edge, fully visible. No
  disclosure is ever placed in the Brief.
- Right column = asymmetric bento of section boxes:
  - Sections render in **JSON section order**.
  - **First section = wide hero** (spans the full right column width).
  - Remaining sections alternate: pairs sit 2-up; a leftover odd section spans
    full width. Concretely for the current 4 sections (Tools, News, Case
    Studies, People): Tools = hero (full), News + Case Studies = 2-up, People =
    full. This is a deterministic size pattern keyed off index, not item count.
  - A thin full-width **"Read everything →"** bar sits at the bottom of the
    right column (replaces today's `tile-feed`, same navigation to `#feed`).
- Each section box (`SectionTile`) keeps its current anatomy: section label
  (emoji stripped), preview headline (plain text, 2-line clamp), and the
  *"…and more inside"* depth cue. Numerals stay banned. The whole box is one
  `<button>` carrying `view-transition-name: pulse-sec-<id>`.

### Mobile (≤560px)
- Collapse to a single column: Brief on top, section boxes stacked full-width,
  "Read everything" bar last. The takeover is unchanged (it already fills).

## Signature color system

Assignment is **by section id** (stable across issues), with a deterministic
fallback for unknown ids (cycle through the palette by index).

| Section id | Hue name | Accent (edge/kicker text) | Tint surface |
|---|---|---|---|
| `tools` | gold | `--accent` `#6e530e` | `#f5ecd6` (existing `--tag-shift-bg`) |
| `news` | terracotta | `#8f4524` (existing `--tag-trending-fg`) | `#f7e8df` (existing `--tag-trending-bg`) |
| `case_studies` | green | `#1f6e5c` (existing `--tag-new-fg`) | `#e4efe9` (existing `--tag-new-bg`) |
| `people` | slate blue | `#3a5a78` (NEW) | `#e6edf2` (NEW) |

- Expose as CSS custom properties set per box, e.g. `--sig` (accent) and
  `--sig-bg` (tint), so one rule styles edge + tint + kicker.
- Three of the four hues reuse existing signal-tint pairs already in the token
  table — no new contrast risk.
- **Slate blue is the one new pair.** Before shipping, compute:
  - `#3a5a78` on `#e6edf2` (kicker text on tint) — must be ≥ 4.5:1.
  - `--ink` `#2c2a26` and `--ink-soft` `#5f594e` on `#e6edf2` (headline/meta on
    tint) — must be ≥ 4.5:1.
  - If any fails, darken the hue until it passes; record the ratios in the
    buddy-system contrast table and `index.css`.
- Slate blue must read as a muted slate, never "AI purple" or neon (anti-pattern).
- Headlines and meta inside boxes stay `--ink` / `--ink-soft` (high contrast on
  every tint). The signature hue colors the **edge + kicker label** only.

## Fill-screen takeover (Section view)

- Reuses the existing Section view + hash routing + `withViewTransition`. No new
  routing layer. The morph uses the existing `pulse-sec-<id>` view-transition
  name shared between the Glance box and the Section surface.
- On open, the Section surface becomes a **full-bleed panel filling the content
  area**, background = that section's `--sig-bg` tint. (The masthead/RoboBuddy
  persists above it, per buddy-system "RoboBuddy on every view"; "fill the
  screen" = fill the main content area.)
- Inside the panel, top to bottom:
  - The ink/marker-yellow gradient rule, then the section label (emoji stripped)
    in the section's `--sig` accent.
  - The section's cards in a **centered reading column at `--maxw` (720px)** —
    dramatic frame, calm measure. Cards render via the existing `Section` /
    `ItemCard` components, unchanged.
  - The existing "← At a glance" back link (top) and "Read everything instead"
    link (bottom) stay.
- Motion: one 250ms `--ease-settle` morph, reduced-motion = instant swap (both
  the JS wrapper and the CSS `::view-transition-*` override already enforce
  this). Nothing animates at rest.

## Components touched

- `GlanceGrid.tsx` — new two-column shell (Brief left, bento right); render the
  "Read everything" bar; pass signature color to each `SectionTile`.
- `SectionTile.tsx` — accept/derive signature hue by section id; set `--sig` /
  `--sig-bg`; mark hero vs standard size (prop or index-derived class).
- `Section.tsx` — accept an optional signature hue + a "takeover" flag so the
  Section view can render the full-bleed tinted panel with a centered column.
- `index.css` — signature color tokens, `--maxw-glance`, the bento grid rules,
  the takeover panel styles, mobile collapse. Keep tokens in sync with the
  buddy-system SKILL.md.
- `lib/` — a small pure helper mapping section id → signature hue (with index
  fallback), so the mapping is testable in isolation.

## Accessibility & theme guardrails

- Every shipped text/background pair ≥ 4.5:1 (verify slate-blue pair explicitly).
- `:focus-visible` ring on every box and link (already global).
- Hit targets ≥ 40px (boxes are large; the feed bar and links meet the floor).
- No dark backgrounds, no gradient washes (tints are flat fills + one flat left
  edge), no red, no neon, no third typeface, no emoji in headings/labels.
- Voice unchanged: "← At a glance", "Read everything", "…and more inside" — no
  urgency, no counts, no exclamation marks.

## Verification

- `pulse-design-review` after the visual change (required sub-skill).
- Manual: Glance renders the bento with four signature colors; clicking each box
  morphs to a full-screen tinted takeover with readable cards; "← At a glance"
  returns; browser back/forward work; `#feed` unchanged; reduced-motion swaps
  instantly; ≤560px collapses to one column.
- Confirm the slate-blue contrast ratios pass and are recorded.

## Open defaults (confirmed during brainstorming)

- Brief is always-open, not a takeover target. ✔
- Hero = first section by JSON order; size pattern keyed off index. ✔
- Masthead persists during takeover. ✔
- Signature color keyed by section id, palette-cycle fallback for unknown ids. ✔
