# Reaction Mark: one pixel heart (Design)

**Date:** 2026-09-22
**Status:** v3.5 approved by Ali. v1, v2 and the v3 square grid superseded, see the
revision notes below.
**Builds on:** the reader feedback loop (`docs/superpowers/specs/2026-09-22-feedback-loop-design.md`)

## Problem

The feedback loop shipped its transport, its contract and its storage, but no control
Kajol can actually tap. Two silent signals (Details opened, headline clicked) carry all
the weight, and a silent signal cannot tell the curator why.

## Revision 2026-09-22 (1): two marks became three faces

The first build put two look-alike buttons in the meta row: a More mark that climbed
none -> more -> loved on repeated taps, and a Less mark beside it. Ali reviewed it
running and ruled against it on two counts.

1. **The two buttons were ambiguous and extra.** Two glyphs in the same cell language,
   differing only in silhouette, did not say which was which, and the third level was
   hidden behind a second tap on the first one.
2. **The colour-only change was too subtle to see.** Lighting four corners of a grid
   that was already drawn is not a visible enough answer to a tap.

The answer built next was three always-visible faces: frown, smile, heart, each its own
5x5 pixel screen, each a direct pick.

## Revision 2026-09-22 (2): three faces became one screen

Ali rejected the faces on sight. The ruling that replaced them, and that this spec now
describes:

- Feedback has **three states only**: none, like, super like. The dislike leaves the
  card entirely. The backend still accepts `less` and the resolver still understands it;
  nothing sends one any more.
- There is **one tappable element** per card.
- The two upper stages must each **animate visibly and uniquely**. A control that only
  changes colour does not read as having done anything.

Chosen visual language: **Boot then Glow**. Chosen cycle: **tap climbs, hold clears**.

The event contract, the transport, the persistence shape and the chip mechanics are
unchanged by either revision.

## Revision 2026-09-22 (3): the square screen became a heart

Ali reviewed v3 running and ruled two changes.

1. **The screen is a heart.** The 5x5 square grid becomes a 7 wide by 6 tall pixel
   heart. The cell language, the geometry and every gesture stay; the silhouette
   changes, so the control says what it means before anything lights up.
2. **Like must be obvious.** The checker that lit half the grid was too quiet to read
   as an answer. `more` now lights the **whole heart** in `--accent`, still sweeping
   one row at a time from the top.

A third motion joins the landing at super like: a single **heartbeat**, the rig scaling
1 -> 1.15 -> 1 over 300ms on `--ease-settle`, replayed with the shimmer when she taps a
heart already at the top.

Everything else is unchanged: one button, tap climbs, hold clears with the progressive
dim, Delete and Backspace clear, the event contract, the chips, the layout, the
"Like this" labels, and no `title`.

## Revision 2026-09-22 (4): louder like, escalated super like

Ali, on the live build: **"like is still unnoticeable."** Two rulings.

1. **Like must be much more noticeable.** The whole heart lights, and it gains a
   heartbeat of its own on entry, so the raise is not carried by fill alone.
2. **Super like escalates to stay clearly apart.** The body brightens to `#f6b53d`,
   the upper left lobe and the centre column take `--brand-yellow`, the rig sits at a
   permanent `scale(1.12)`, and the landing beat doubles.

## Revision 2026-09-22 (5): like is green

Ali again, on the live build: **"the like change is still too hard to see; use a
different colour for like."**

`more` is now `#1f9e6e`, the `case_studies` signature green from `src/lib/buddy.ts`,
reused as the "liked" colour. Deep gold and then bright amber had both read as a
variation on the resting grey rather than as a different state. The ladder is now
**green then gold**: two hues at two brightnesses, so the change is unmistakable at 1x.

Super like is unchanged from revision 4. Rest is unchanged at `#938d7e`, which is what
keeps the control identifiable at 3.25:1.

## Revision 2026-09-22 (6): polish, from pixel-measured review

Six findings against the v3.4 captures, all applied.

1. **The shimmer was masked to the button, not to the heart.** Mid-glow, 16px of pale
   yellow sat outside the silhouette and the concave notches filled in. The band is now
   an SVG gradient rect drawn inside the rig under a `clipPath` built from the same 27
   cells, so nothing outside them can change. Measured after the fix: at 150ms into the
   glow, 346 pixels lit on the cells and **0 pixels changed outside them**, with the
   crest still at exactly 0.35 alpha.
2. **The persistent `scale(1.12)` is gone.** It resampled everything: the outline
   rounded to a soft 1 to 2px, the cells lost their edges, and the grown ink pushed 3px
   into the mobile gutter. Super like is now a physically bigger rig, the same 27 cells
   at a 2px gap instead of 1px, 40x34 of ink against 34x29 at the other levels. Every
   edge stays on a whole pixel at both sizes. The beats remain the only transforms on
   the rig, and both now end at 1.
3. **The mobile river.** At <=480px the group takes `flex-basis: 100%` with no offset,
   and the rig left-aligns inside its own button, so the ink starts on the river at
   every level rather than a negative offset tuned to one of the two widths. The heart
   also leads the group at that width, so it is the ink and not the landing word that
   lands on the river.
4. **The silhouette edge no longer pops.** Under `data-holding` it fades on the same
   350ms linear the cells use, so it leaves with them instead of surviving to the commit
   and vanishing in one frame; elsewhere it fades on `--motion-md`.
5. **The landing word moved left of the heart**, so the heart and the Details toggle
   cluster on desktop. It is still always rendered at a fixed width, so nothing shifts.
6. **The halo is capped at 1.4x below 480px**, so it stays inside the card's padding.

## What it is

One pixel heart button per section ItemCard, in the meta row's actions group: the noted
slot first, then the heart, then the Details toggle, so the heart and the toggle cluster
together on the right on desktop. At <=480px the heart leads instead, so its ink lands on
the river. The Brief carries no mark.

- **Tap** climbs none -> like -> super like.
- **Press and hold** (500ms) clears back to none, from either raised level.
- **Delete or Backspace** clears from the keyboard while the button has focus.
- **Tap at the top** replays the shimmer and the heartbeat and nothing else, so the
  control still answers.
- **Reason chips**, the positive set only, appear inside Details once the level is
  raised.

## The heart

Inline SVG, `aria-hidden`, inside a 40x40 `<button>`. Seven cells wide and six tall on
whole-pixel geometry: 4px cells, 1px gaps, 34x29 of ink on a 34x29 `viewBox`, `rx` 0.75,
`shape-rendering: crispEdges`, centred in the button, so every edge lands on a device
pixel.

Only the heart's own cells exist. There is no dim grid behind it, so the shape is a
recognisable object before it is a state.

```
. X X . X X .
X X X X X X X
X X X X X X X
. X X X X X .
. . X X X . .
. . . X . . .
```

**27 cells**, row major: 4 + 7 + 7 + 5 + 3 + 1. `:nth-child` follows that order, and so
do the `--r` (row) and `--d` (column plus row) tables in `index.css`.

| State | Cells | Colours | Motion on entering |
|---|---|---|---|
| none (rest) | all 27 dim | `#938d7e`, 3.25:1 on `--card` | none; clearing dims every cell together, no stagger |
| like | the whole heart | `#1f9e6e`, 3.0:1 | rows fill top to bottom, `transition-delay` = row x 45ms, fill 250ms `--ease-settle`, plus one **heartbeat** |
| super like | the whole heart, drawn larger: same 27 cells at a 2px gap, 40x34 of ink | body `#f6b53d`, core (1,1) (2,1) (3,1) (1,2) (3,2) `--brand-yellow`, tip (3,5) `--accent`, 1px `--accent` silhouette edge | cells arrive on a 30ms diagonal stagger, plus a **double heartbeat**, one **shimmer** and one **ring** |
| super like, tapped again | no change | | the shimmer and the double beat replay: no event, no ring |

The upper left lobe and the centre column carry the marker yellow and the point at the
bottom holds the deep gold, which is what keeps the amber from reading as one flat wash.

**Two of the three states are not carried by hue.** Super like alone gains the
silhouette edge and is drawn at a larger size, so none against super like survives a
greyscale reading, which `#938d7e` against `#f6b53d` on its own does not.

The size difference is **drawn, not scaled**: 4px cells with a 2px gap rather than 1px.
A transform would have resampled the outline to a soft 1 to 2px and blurred the cells,
and on a narrow screen the grown ink pushed past the text river.

Fills and both stagger indices are driven by CSS from `data-level` on the button and
`:nth-child` per cell, never from React `fill` attributes, so one attribute change
animates the whole heart.

The resting colour is what identifies the control, so it answers to WCAG 1.4.11 (3:1 for
non-text) rather than to the decoration exemption. The lit ambers sit below 3:1 and are
listed in the buddy-system decoration table as decoration.

## Motion

Tokens `--motion-md` (250ms) and `--ease-settle`, plus one sanctioned one-shot
exception covering the three motions below.

- **The shimmer:** a diagonal highlight band drawn as an SVG gradient rect (a
  `linearGradient` with `stop-opacity`, `--brand-yellow` cresting at 0.35 alpha) under a
  `clipPath` built from the same 27 cells, sweeping top-left to bottom-right once over
  500ms. A keyed `<rect class="mark-shimmer" aria-hidden>` that unmounts on
  `animationend`. Base `opacity: 0`, so reduced motion leaves nothing visible.
- **The ring:** a keyed `<span class="mark-ring" aria-hidden>` sized to the heart it
  comes from (34px), fading 0.55 -> 0 on a linear curve while scaling 1 -> 1.6 on
  `--ease-settle` over 400ms, fired only on reaching super like and never from restored
  state.
- **The heartbeat:** the rig scales on `--ease-settle`, once. One pulse at like
  (1 -> 1.15 -> 1, 300ms); two at super like (1 -> 1.18 -> 1.05 -> 1.18 -> 1, 450ms).
  These are the only transforms on the rig: the size difference between levels is drawn
  rather than scaled.
  It is driven by a `data-beat` attribute on `.mark-rig` rather than by a React key,
  because remounting the rig would replace every cell with a brand new element, and a
  brand new element cannot transition, which would silently cancel the diagonal fill
  stagger playing on the same landing. The attribute is cleared on `animationend`, so
  the next landing or replay restarts it. A re-tap inside the beat's own duration does
  not restart it, because the attribute has not changed yet; the shimmer, which is
  genuinely keyed, still does.
- Both spans carry namespaced keys (`shimmer-1`, `ring-1`). They are siblings, so a bare
  counter would give both the key `1` on the same landing and one would lose its ref.
- The reduced-motion block zeroes `transition-delay` explicitly, because the global rule
  only zeroes duration. Under reduced motion the JS guard skips the ring, the shimmer
  and the heartbeat alike: no sweep, no shimmer, no halo, no pulse.

## The hold gesture

`src/lib/useHoldToClear.ts`, on Pointer Events, with its own unit test.

- `pointerdown` with the primary button arms two timers. At **150ms** the button gets
  `data-holding="true"` and the lit cells fade toward the resting colour over 350ms, so
  letting go early visibly snaps back. At **500ms** the clear fires.
- `pointerup`, `pointercancel` and `pointerleave` before 500ms cancel both timers, and
  the press stays an ordinary tap. Note the platform difference: on touch, **implicit
  pointer capture** means `pointerleave` does not fire while the finger slides off the
  button, only at release, so a finger that wanders still completes the hold. A desktop
  mouse has no such capture, so leaving the button cancels immediately. Both are the
  behaviour a reader expects on that input.
- A completed hold sets a flag that the button's `onClick` consumes and returns on, so
  the click the browser sends after `pointerup` never climbs the level straight back up.
  Answering the question clears the flag, and so does the next `pointerdown`, **before**
  the enabled guard: a completed hold does not always produce a click (a finger that slid
  off, or Safari after a long press), and a flag left set would swallow the next genuine
  tap on what is by then a resting heart.
- A second `pointerdown` while one is armed calls `stop()` first, so an abandoned press
  can never leave an orphan timer that fires a clear on its own.
- A non-primary button is never a hold. No hold is armed when the level is none.
- The button carries `touch-action: manipulation`, `user-select: none` and
  `-webkit-touch-callout: none`, and prevents `contextmenu` on itself, so the platform
  does not raise a selection or a callout over the gesture.

## Landing

Unchanged: an always-rendered `.noted` slot (`inline-size: 4.5em`) fades to opacity 1
for 1.2s so nothing shifts, and a per-card visually hidden `role="status"` reads "Noted"
on a raise and "Cleared" on a clear, emptied on the same timer so repeats re-announce.

## Copy and a11y

- `aria-label` carries the level: "Like this" / "Like this, liked" / "Like this, super
  liked". There is no `aria-pressed`, because three states are not a toggle.
- `aria-description`: "Tap to raise. Press and hold, or press Delete, to clear."
- **No `title`.** A long press on mobile Safari raises the title callout, which would
  fight the hold gesture.
- The Details toggle's open label stays **"Hide"**. It no longer has to avoid the phrase
  "Less like this", which v3 removed, but "Hide" is the clearer word for what it does.
- `:focus-visible` outline per law; `inert` on the closed Details panel stays.

## Layout

- `.card-meta`: `flex-wrap: wrap; gap: var(--sp-1) var(--sp-3); min-height: 40px`.
- `.card-source`: `flex: 1 1 12ch; min-width: 0`, with the date in its own
  `white-space: nowrap` span so a narrow row breaks at the separator.
- `.card-actions`: the mark, the noted slot, the Details toggle. Right-aligned on
  desktop, one line. At <=480px it takes `flex-basis: 100%` with `margin-inline-start:
  0`, and the rig left-aligns inside its own button (`.mark { order: -1; justify-content:
  flex-start; }`), with the heart leading the group so its ink, not the landing word,
  starts on the river. No single negative offset could put all three sizes of the heart
  on the river, since the heart is two different widths at two different levels; the row
  stays a single 40px line.
- `.card-toggle`: `min-inline-size: 4.75rem`, `justify-content: flex-end`, no end
  padding, so swapping "Details" for "Hide" cannot move the mark and the chevron's ink
  meets the river in both states.

## Chips

Inside Details, at the bottom of `.card-detail-inner`, when the level is raised: a
`<p id>Why</p>` plus a `<div role="group" aria-labelledby>` of `aria-pressed` pills.

**The positive set only**, at both like and super like: client_ready "Client-ready",
learned_something "Taught me something", good_numbers "Good numbers", worth_following
"Worth following", my_industry "My industry". `REASONS_NEGATIVE` stays exported and
stays in the known-id filter, because the API and the backend still know those ids, but
the UI never renders one.

The pill shares one grouped rule with `.card-kicker` (family, size, tracking,
line-height, `border-radius: 999px`) and diverges where being a control forces it to:
40px tall with `--sp-3` horizontal padding. Both states keep the `--cream-2` fill; lit
adds `box-shadow: inset 0 0 0 1px var(--accent)`, `--accent` ink (6.2:1) and weight 600
against the unlit `--ink-soft` at 400.

A card with no summary and no terms still gets the Details toggle once a reaction opens
the Why row, and `.card-detail` carries `inert` while closed. `ItemCard` clears its
`open` state whenever the panel stops being available, so a bare card marked again never
returns already expanded.

## Interaction model and events

Backend semantics (`backend/reader_profile.py` `resolve_reactions`): an `undo` pops the
most recent kept explicit event for (client, canonical url); reasons ride on the
explicit event; a stray `undo` is a no-op.

To stay correct even when localStorage was evicted or lost, every explicit send is
preceded by an `undo`:

| Landing level | Events emitted |
|---|---|
| like / super like | `undo`, then `more` / `loved` (with `reasons` when any) |
| none | `undo` |
| tap at super like | nothing |

Changing level clears reasons. A chip toggle re-emits `undo` plus the current kind with
the full reasons list (an empty list is omitted by the transport). Every event carries
`url` and `section`; `issue_id` comes from the transport context.

The `undo` and its kind are recorded in the same millisecond, so their `ts` values are
identical. Correctness rests on append order plus a stable sort: the transport appends in
call order, and both `Array.prototype.sort` (the local mirror) and Python's `sorted`
(`resolve_reactions`) are stable, so the `undo` always resolves before the kind that
follows it.

## Persistence

`frontend/src/lib/reactions.ts` keeps
`{ [issue_id]: { touched: ISO, urls: { [url]: { level, reasons } } } }` under
`pulse.reactions.v1`. Eviction is by lowest `touched` beyond 5 issues, never by id
(same-day `-2` ids sort wrongly by string), and an issue with nothing marked on it gives
its slot back first.

The parse is lazy and synchronous into an in-memory mirror on first read (the
`feedback.ts` `readQueue` idiom, `storageOk = false` on throw). Entries are immutable
objects replaced on change, so `useSyncExternalStore` snapshots are stable and restored
state is present on the first render with no effect and no flash. `sanitize` drops
unknown levels and unknown reason ids, which is also how a `less` written by v1 or v2
quietly disappears.

The store's one verb is `setLevel(url, section, level)`, where `level` may be `"none"`.
The store does what it is told; the component owns the gestures. The issue id arrives
through `reactions.setIssue(id)`, called in `App.tsx` right before `feedback.setContext`.

Note: backend identity ignores the issue id while persistence is keyed by it. That is
consistent today because `seen_urls` prevents a url recurring across issues.

## Files

- New: `frontend/src/lib/reactions.ts`, `frontend/src/lib/useHoldToClear.ts`,
  `frontend/src/components/ReactionMarks.tsx`,
  `frontend/src/components/PixelScreen.tsx` (the `PixelHeart` rig),
  `frontend/src/components/ReasonChips.tsx`.
- Edited: `frontend/src/components/ItemCard.tsx`, `frontend/src/App.tsx`,
  `frontend/src/index.css`, `.claude/skills/buddy-system/SKILL.md`,
  `.claude/skills/pulse-design-review/SKILL.md`, `DESIGN.md`, `README.md`,
  `CHANGELOG.md`.

## Anti-goals

No faces, thumbs or stars. No counts. No red. Nothing animates at rest. No
second control. No modal. No controls in the Brief. The mascot does not move or speak.

## Out of scope

The dislike on the card (removed), the per-issue check-in, mascot involvement, backend
or API changes, the profile report.
