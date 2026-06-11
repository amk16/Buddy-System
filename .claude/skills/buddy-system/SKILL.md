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
  --brief-bg: #fbf4e6;     /* the Brief — slightly sunlit cream */
  --border: #e7e0d2;       /* hairlines */
  --border-strong: #d8cfba;/* section rules */

  /* ink */
  --ink: #2c2a26;          /* primary text */
  --ink-soft: #5f594e;     /* secondary text */
  --accent: #9a4a2a;       /* terracotta — links, rules, markers */
  --accent-deep: #8f4524;  /* hover/active terracotta */

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
| `--accent` on `--paper` | 5.8:1 |
| `--accent` on `--card` | 6.1:1 |
| `--tag-trending-fg` on its bg | 5.8:1 |
| `--tag-new-fg` on its bg | 5.2:1 |
| `--tag-shift-fg` on its bg | 6.1:1 |

When introducing ANY new color pair, compute its ratio first; below 4.5:1 it
does not ship.

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

## Mascot — RoboBuddy hard rules

RoboBuddy is strictly **ambient**. It may: sit still in the glance grid's
buddy corner, and anchor the optional "pick up where you left off" chip
(localStorage, one entry, per-issue). It may NEVER: animate, block content,
auto-navigate, speak/instruct, show progress, appear modal, or appear outside
the glance view. The resume chip disappears permanently once used or
dismissed, and never exists when there's nothing to resume.

## Layout & spacing

- Reading views (section, feed): single centered column,
  `max-width: var(--maxw)` (720px) — one calm vertical river. The glance
  bento is the ONLY sanctioned grid, and it lives inside the same column.
- Glance tiles: whole tile is one `<button>` named by its section label; the
  preview headline is plain text (real links live in the section view);
  *"…and more inside"* is the only permitted depth cue — numerals stay banned.
- 4px spacing scale. Conventions: padding inside cards `--sp-4`/`--sp-5`;
  gap between cards `--sp-4`; gap between sections `--sp-6`/`--sp-7`;
  masthead breathing room `--sp-7` below.
- Card anatomy (top to bottom): kicker pill → headline → why-it-matters →
  meta row (source · date · Details toggle) → [expanded: summary → terms].

## Component conventions

- **Brief** — always fully visible; it IS the skim layer. Never put a
  disclosure inside the Brief. Cream `--brief-bg` panel with a 3px terracotta
  left edge.
- **ItemCard** — collapsed by default: pill, headline (external link),
  why-it-matters, meta row. Expansion is a `<button>` with `aria-expanded` and
  `aria-controls`; expanded region holds summary + terms `<dl>`. A card with
  no summary AND no terms renders no toggle. Never auto-expand.
- **Section labels** — JSON labels contain a leading emoji; strip it at render
  time, never show emoji in headings. A short terracotta rule above the label
  does the anchoring instead.
- **ArchiveSwitcher** — stays a native `<select>` (keyboard/screen-reader free
  wins). Restyle only.
- **Reading-time chip** — lives under the masthead date, format
  `N min skim · M min full read`, sans, `--ink-soft`. Its job is reassurance:
  the depth is optional.

## Voice & copy

- Calm over clever. UI labels are one quiet word: "Details", "Less", "Issue".
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
3. Alarmist red anywhere — even error states use `--accent` terracotta.
4. Dense walls of text in a card's collapsed state.
5. More than 2 typefaces.
6. Emoji in pills, buttons, or headings.
7. Decorative animation (motion only as state feedback, ≤ 250ms, eased).
8. Anything implying a task, deadline, count, or backlog.

REQUIRED SUB-SKILL after any visual change: run `pulse-design-review`.
