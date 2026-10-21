# Changelog

Every notable change to **AI Marketing Pulse** — the engine that curates issues, the
dashboard that renders them, and the source network they're drawn from.

## How this file works

- **Newest release on top.** Each release has a `version`, a `date`, and a one-line
  *theme* — the headline change in plain language.
- Changes are grouped by **pillar**, so you can scan for the part you care about:
  - 🧠 **Engine** — the curation pipeline (`backend/`): collection, validation, the rules.
  - 🎨 **Dashboard** — the React reading experience (`frontend/`): layout, design, motion.
  - 📡 **Sources** — the feed network and what gets curated (`config.yaml`, sections).
  - 🧰 **Tooling** — skills, slash commands, deploy/config plumbing.
- Within a pillar, tag each line **Added / Changed / Fixed / Removed**.
- **Versioning** (loose semver, product-flavored):
  - **MAJOR** — a new way of reading or generating an issue (e.g. a new front door).
  - **MINOR** — a new section, feed tier, mascot behavior, or design layer.
  - **PATCH** — copy, contrast, dedup, and review-round polish.
- **Issues are content, not releases.** New dated issues (`frontend/public/issues/*.json`)
  ship continuously and aren't tracked here unless they change the *format* of an issue.

### Template for the next entry

```md
## [vX.Y.Z] — YYYY-MM-DD — <one-line theme>

🧠 Engine
- Added/Changed/Fixed: …

🎨 Dashboard
- Added/Changed/Fixed: …

📡 Sources
- Added/Changed/Fixed: …

🧰 Tooling
- Added/Changed/Fixed: …
```

---

## [v1.5.5] — 2026-10-22 — Motion made cheap

🎨 Dashboard
- Fixed: the boot cover's choreography no longer runs as 1,400 separate timers each
  forcing its own style recalc, nor re-renders all 693 cells sixty times a second for the
  readout. One frame loop flushes the due paints and writes the count straight to the DOM.
  The housing's shadow is a box-shadow on a wrapper instead of an SVG drop-shadow filter
  (which re-rasterised the whole screen on every cell change), and the lift transitions
  transform only (the edge shadow is painted once and revealed, not animated), so the sheet
  moves on the compositor alone. Measured in Chrome on the 2017 i5: the raster sweep,
  noise, drawing, hold and lift now run at 60 fps from the first second onward.
- Fixed: the glance grid read every tile's box inside its mount commit, forcing a
  synchronous layout of the freshly mounted page (about 170 ms on this machine) under the
  cover and again on every return from a section. The first read now waits a frame.
- Fixed: each reaction heart carried a second copy of its 27 cells as a clip path that only
  the super-like shimmer uses. The clip and gradient now exist only while the shimmer
  plays, which removes about 570 SVG nodes from a section page (1,302 to about 735) and
  took the section open and back from three dropped frames each to one.

🧰 Tooling
- Added: a performance instrument (session scratchpad `perf.mjs` / `perf2.mjs`): frame
  deltas and long tasks per phase (boot, hover, section open, back, scroll) against the
  dev server and a `vite preview` production build, plus the real-Chrome trace via the
  DevTools MCP. Finding: the dev server (unminified, React dev, StrictMode) costs about
  five times the script time of production and should never be used to judge motion.

---

## [v1.5.4] — 2026-10-22 — The pencil, traced from the real logo

🎨 Dashboard
- Changed: the boot screen's pencil is now traced from the agency's original logo (the
  500 px transparent PNG on wearescribbld.com) instead of a 60 px screenshot. Measured:
  it leans 53.9 degrees with the point at bottom-left, the body is 0.235 of its length
  wide, and from the point it is graphite, an orange cone, a thin gap across the body,
  then the body to a flat end with rounded corners, in one orange lightening toward the
  flat end. The invented stripe and wood collar are gone. The grid is 33 × 21 cells in the
  same housing, rasterised by area coverage (a cell lights at 45% inside and takes the
  part that covers it most; the gap stays unlit). The choreography is retimed to the
  a slower pace (Ali, 2026-10-22): a 1 ms-per-cell sweep, ten sixty-cell noise frames, the
  pencil resolving at 7 ms a cell from its point, the written cell after 420 ms, and a
  900 ms breath: the cover holds about 3.9 s. The lead and the written cell are the heart's
  resting grey `#938d7e`: ink on the screen's dark was invisible.

🧰 Tooling
- Added: `docs/lab/boot-cover/pencil.html`, the logo, the raster and the live geometry
  side by side; the generator (`pencil3.py`, session scratchpad) measures the logo and
  emits `src/lib/pencil.ts`.

---

## [v1.5.3] — 2026-10-22 — The boot screen draws the pencil

🎨 Dashboard
- Changed: the boot cover's screen no longer resolves RoboBuddy's face. It draws the
  **Scribbld pencil**, traced from the wordmark: a three-cell body in the brand highlight
  with a light edge along its upper side, a cream wood collar, a darker cap at the flat
  end and an ink point, leaning 29 degrees with the point at bottom-left. The screen
  keeps BuddyPeek's housing but its grid doubles to 22 × 14 cells so the pencil reads as
  a pencil. Choreography: raster sweep, eight frames of amber noise, the pencil resolving
  from its point at 12 ms a cell, then the point writes one ink cell and the drawing
  holds until the lift. The bitmap lives in `src/lib/pencil.ts`.

---

## [v1.5.2] — 2026-10-22 — The band comes off

🎨 Dashboard
- Removed: the takeover's dithered band on the left edge. The section's hue is spent
  once, in the lower half of the sliver above its label (as the glance tiles do on
  reach); the takeover is paper with a hairline border. A honeycomb mark was tried in
  its place and ruled out the same day.

---

## [v1.5.1] — 2026-10-21 — Orientation sweep: every edge, gap and centre measured

A measured sweep of containers, edges, gaps, centring, overflow and hit targets across
glance, takeover, feed, boot cover, empty and error states at eleven widths and two
heights (`docs/audits/2026-10-21-orientation-sweep.md`). One real drift, fixed.

🎨 Dashboard
- Fixed: the two-column glance held on down to 561px, where a half tile's text column was
  41–100px wide (52px at 600, 100px at 768) and the peeking buddy crossed tile text at
  600. The glance now collapses to Brief-over-bento at **900px**; the bento keeps its two
  columns until 560 as before.
- Verified clean at every width: all containers share the `.app` edges; the masthead
  rhythm is 32 / 12 / 48; the glance runs one 24px rhythm; takeover column centred with
  equal remainders; cards 16 apart; sections 48 apart with 24px tape padding; no
  horizontal overflow; no text crossing the viewport; every control ≥ 40px; the boot
  cover's screen centred and its wordmark inside a 16px gutter; recovery panel centred.

- Changed: **the glance Brief fits the wall.** The Brief stretches to the bento's height
  and the bento to the Brief's, so the two columns end together; on the glance each
  Brief item clamps to three lines (headline plus the start of its why), the full
  lines living in the feed. The wall's rows absorb any px of difference.
- Changed: **RoboBuddy centred in the portrait.** The figure's opaque bounds in the PNG
  were measured (x 40–278 of 418, y 107–479 of 597); the image is drawn at 105% of the
  frame and placed from the figure's own centre, so the whole figure sits centred at
  112 and 92 alike.

🧰 Tooling
- Added: the sweep instrument (scratchpad, documented in the audit) and CSS-contract pins
  for the 900px collapse, the Brief fit and the portrait placement (frontend 201).

---

## [v1.5.0] — 2026-10-21 — One hue per station: the palette re-spent, the whitespace set on purpose

The same tokens, used the way The Laboratory uses its own: ink and paper carry the
screen, one hue per view, colour as the signal that you changed station. And the
whitespace audit's plan, applied.

🎨 Dashboard
- Changed: **the brand highlight is `#F78D1D`** (Scribbld's real highlight; the marker
  yellow `#ffd700` was off-brand). `--brand-highlight` replaces `--brand-yellow` in
  every use: underlines, slivers, the super-like heart's core and shimmer, the retry
  link. The ROBOBUDDY nameplate flips to ink text on a highlight chip (5.9:1); the
  highlight is never text.
- Changed: **the glance is monochrome chrome.** Section tiles sit on card with ink
  labels and the ink-over-highlight sliver; a section's hue appears only on reach
  (hover/focus lights the sliver's lower half and the 3px left edge). The Brief is the
  one tinted surface, the highlight at a tenth into paper (`--brief-bg` is now that
  mix); the dialog box goes to card; the feed tile is paper with a dashed rule.
- Changed: **the takeover spends its hue once**, as a 24px ordered-dither band down
  its left edge (four steps of the section hue into paper), on a paper ground with
  white cards; the label is ink and its rule carries the hue in its lower half.
- Added: **register tape** between feed sections — 8px ink cells at half strength,
  the pixel language as a rule.
- Changed (whitespace plan, `docs/audits/2026-10-21-colour-and-whitespace.md`): the
  masthead row is the portrait's 112px (92px below 560) instead of ~235px by the
  image's aspect, so the Brief lands above the fold; one `--sp-5` rhythm across the
  glance (Brief to wall, tile to tile) and `--sp-5` padding on the Brief; the tile
  safe zone is 72px and the hero keeps it on hover devices (a specificity bug had
  dropped it to 24px); half tiles draw the peek a size smaller (64px) so their text
  column keeps ~190px; the takeover's bottom padding is `--sp-6`; card internals share
  one `--sp-3` rhythm; the actions gap is `--sp-2`.

🧰 Tooling
- Changed: design law — `--brand-highlight` replaces the yellow in the token block,
  the brand-language section, the decoration table (five new rows: hover edge, the
  takeover band, the tape, the Brief ground); a "One hue per station" rule under
  Layout; the bento-width sentence corrected to 1040px (`--maxw-glance`); the spacing
  conventions updated. `DESIGN.md` mirrored.
- Added: the audit and the lab (`docs/lab/palette-fusion/`, rounds 1 and 2, with a
  Before/After toggle on the real stylesheet and issue); CSS-contract rows for the
  highlight, the masthead row, the rhythm, the hue-on-reach rule, the safe zone and
  the tape (frontend 198).

---

## [v1.4.0] — 2026-10-21 — The boot cover: RoboBuddy's screen boots the issue

The dashboard no longer opens on a bare masthead and a grey "Loading…" line. For
about two seconds RoboBuddy's own pixel screen stands alone on the paper and boots
like a machine, a readout counts in the corner, the wordmark sits at the bottom edge,
and then the whole sheet lifts off the top with the finished page beneath it.

🎨 Dashboard
- Added: **BootCover**, "Self-test" (`src/components/BootCover.tsx`) — a full-viewport
  cover shown once per page load. RoboBuddy's 11x7 screen (the BuddyPeek geometry and
  bitmaps from `lib/buddy.ts`, now exported as `GRID`, `faceCells`, `facePalette`) is
  drawn at viewport scale and boots: a dim raster sweeps every cell, nine frames of
  amber noise, then the eager face resolves eyes-then-mouth and blinks once. A serif
  readout counts `000` to `100` top-left on a timer (never bytes), a mono stamp top-right
  carries the day and the issue's size, "Buddy-System" rises viewport-wide at the
  bottom edge, and a single SVG grain layer dresses the sheet. A `role="status"` span
  says "Loading today's pulse"; on a slow network the one visible word "Loading…"
  appears on a reserved line.
- Added: the exit is one move — the sheet lifts off the top (`translateY(-102%)`,
  720 ms, `--ease-settle`) with a soft shadow on its lower edge; the page beneath is
  complete and still, and only the greeting types once it clears. Nothing travels.
- Added: boot timing (`src/lib/boot.ts`) — one phase table drives the component and the
  law; the cover holds for the whole self-test plus a breath and until the first issue
  is ready; an empty index or a failed issue drops it at once. Archive and engine
  switches never bring it back.
- Changed: **BuddyDialog** takes `paused`; the greeting typewriter waits for the cover.
- Changed: the reduced-motion check is one shared `prefersReduced()`
  (`src/lib/motion.ts`), guarded for browsers without `matchMedia`; ReactionMarks,
  BuddyDialog and the view-transition helper all use it. `withViewTransition` now
  returns the transition.
- Changed: the page beneath the cover is `inert` until the cover is gone.

🧰 Tooling
- Changed: design law — `SKILL.md` and `DESIGN.md` now name **four** sanctioned motion
  exceptions; exception 4 is the boot cover, with its bounds, and the mascot rule
  carries the one carve-out. Decoration-table rows for the cover's screen, cells,
  raster pass and grain.
- Added: a targeted preloader sweep in the design vault (2026-10-21, 8 measured loaders)
  and three prototyped directions under `docs/lab/boot-cover/` (A Self-test, chosen;
  B The Dispatch; C The Edge), each with the lift-off exit, kept as the lab record.
- Added: tests for boot timing, the cover's phases and DOM, the paused typewriter and
  the CSS contract rows.

---

## [v1.3.0] — 2026-09-22 — The reaction mark: one pixel heart that fills, then glows

The feedback loop finally has something to tap, and it is one thing. Every section
card carries a single pixel heart in RoboBuddy's cell language. A tap fills it with
green, one row at a time from the top, and beats it once; a second tap warms it to
gold, grows it a size, sends a shimmer across it and beats it twice. A press and hold
takes it back down.

🎨 Dashboard
- Added: **ReactionMarks** (`src/components/ReactionMarks.tsx` +
  `src/components/PixelScreen.tsx`) — one 40x40 button holding a 34x29 pixel
  heart, 7 cells wide and 6 tall, 27 cells, all always drawn. Three states,
  none / like / super like: `more` fills the **whole heart** in `#1f9e6e`, the
  case-studies green, sweeping 45ms per row from the top, `loved` warms every
  cell to `#f6b53d` on a 30ms diagonal with the core in marker yellow and the tip
  in deep gold, gains a static `--accent` outline around its silhouette and is
  drawn as a larger rig (the same 27 cells at a 2px gap, 40x34), never a
  transform. Fills and both stagger indices come from CSS keyed on
  `data-level` and `:nth-child`, never from React `fill` attributes.
- Added: **tap climbs, hold clears** (`src/lib/useHoldToClear.ts`) — a 500ms press
  returns the card to none, the screen dimming from 150ms so an early release
  visibly snaps back, and the click the browser sends afterwards is swallowed.
  `Delete` or `Backspace` clears from the keyboard. The button guards
  `touch-action`, `user-select`, `-webkit-touch-callout` and `contextmenu` so the
  platform never raises a selection or a callout over the gesture.
- Added: the landing motions — one heartbeat at like, and at super like a double
  heartbeat, a 500ms diagonal `--brand-yellow` shimmer and the 400ms ring — all
  tap-triggered, never fired from restored state, and all silent under reduced
  motion. A tap on a heart already at the top replays the shimmer and the double
  beat, and lands the word and the live region either way, so the control always
  answers without recording anything.
- Added: **ReasonChips** (`src/components/ReasonChips.tsx`) — a `Why` row at the
  bottom of an expanded card, the five positive chips at both raised levels.
- Added: **`src/lib/reactions.ts`** — the level store. It remembers five issues
  under `pulse.reactions.v1` (evicted by when they were touched, never by id, and
  an empty issue gives its slot back first), restores a level on the first paint
  through `useSyncExternalStore`, and sends an `undo` before every explicit
  reaction so a resend replaces rather than adds even when the local memory was
  lost.
- Added: a fading "noted" slot at fixed width, so the landing never moves the
  row, plus a per-card `role="status"` that says "Noted" or "Cleared".
- Changed: the card meta row wraps, the source gives way first, and the controls
  travel together in a `.card-actions` group. The Details toggle holds one width
  so swapping its label cannot move the mark, its chevron's ink meets the text
  river, and at ≤480px the group takes its own line with the heart's ink on the
  river too.
- Changed: the reason chip shares one pill rule with `.card-kicker` and a pressed
  one is not a tint at all — same `--cream-2` fill, with a gold inset edge, gold
  ink and weight 600, so the state survives a greyscale reading.
- Changed: the open Details toggle reads **"Hide"**, not "Less".
- Changed: a card with no summary and no terms now gets a Details toggle once it
  has been reacted to, because the Why row is content worth disclosing; the
  collapsed panel carries `inert`, so it leaves the Tab order entirely.
- Removed: the dislike on the card. The API and `resolve_reactions` still accept
  and understand `less`, but nothing sends one, and a `less` left in storage by an
  earlier build is dropped on read.

🧰 Tooling
- Added: three **sanctioned motion exceptions** in
  `.claude/skills/buddy-system/SKILL.md`, written beside BuddyPeek and bounded the
  same way (the ring at 400ms, the shimmer at 500ms, and a single 300ms
  heartbeat at like and a 450ms double beat at super like, one shot each,
  tap-triggered, silent under reduced motion), plus a **non-text
  decoration** table naming every value the heart is allowed to paint, with the
  resting colour held to the 3:1 control floor rather than the decoration
  exemption.
- Added: the interactive-state capture block in
  `.claude/skills/pulse-design-review/SKILL.md` — class-driven taps at both
  viewports, a reduced-motion run, and the mid-sweep, mid-glow and mid-hold
  frames on the exit checklist.
- Added: the design spec
  `docs/superpowers/specs/2026-09-22-reaction-marks-design.md`, carrying the
  three revision notes from the designs this one replaced.
- Added: 72 frontend tests covering the store, the screen, the hold gesture, the
  chips and the stylesheet contract.

## [v1.2.0] — 2026-09-22 — Reader feedback loop: reactions → profile → steer

Reactions on cards and issues now flow somewhere: a Vercel function stores them,
each pipeline run turns them into a reader profile, and Ali reviews a proposed
steer before it ever changes what the curator is told.

🧠 Engine
- Added: **`reader_profile.py`** — decayed per-section scoring (recent reactions
  count more than old ones), section mix (current versus ideal), and LLM-proposed
  emergent axes with an evidence-URL guard so no axis is claimed without a real
  card behind it. Also renders a self-contained local HTML report.
- Added: **`--profile`** and **`--accept-steer`** verbs on `pipeline.py`.
- Added: **`steer.yaml`**, merged into `Config` on load; `curate_schema.py` adds a
  READER PROFILE block to the curation prompt for every engine when a steer is
  active, and `pool.json` carries `reader_profile` for the Claude Code engine
  (`CLAUDE.md` rule 8).
- Added: the **`feedback:`** block in `config.yaml` (`half_life_days`,
  `min_explicit_for_proposal`, `top_k`).
- Added: profile generation runs after every publish, wrapped in a guard that can
  never fail the publish itself.

🎨 Dashboard
- Added: silent implicit signals — a card's Details opened, a headline clicked —
  captured through a batched, retry-safe transport (`src/lib/feedback.ts`).

🧰 Tooling
- Added: Vercel Function **`api/feedback.ts`** — validates each event and appends
  it to `feedback/YYYY-MM.jsonl` on the `feedback` branch through the GitHub
  Contents API.
- Added: `vercel.json` disables deployments for the `feedback` branch, so reader
  events never trigger a rebuild.
- Added: **vitest** as the frontend's first test runner.
- Changed: the GitHub Action fetches the `feedback` branch before each run and
  publishes the regenerated `profile/` alongside the issue.

## [v1.1.0] — 2026-07-30 — Autonomous Gemini stream and engine tabs

A second issue-generation engine that runs on its own: grounded Google Search
finds trending items, Gemini curates them, and a scheduled GitHub Action
publishes straight to `main` with no one touching it.

🧠 Engine
- Added: **Gemini autonomous engine** (`--gemini`) — grounded Google Search
  collection, `gemini-3.1-pro-preview` (set in `config.yaml`) for curation, and
  the same real-URL / grounding guarantees as the Anthropic path.
- Added: **`min_items_to_publish`** floor so an unattended run never ships a
  threadbare issue.
- Added: **`url_resolve.py`** — resolves Google's expiring grounding-redirect
  URLs to real publisher links, keeping only what resolves.
- Added: **`curate_schema.py`**, a shared output schema and system prompt so the
  Claude and Gemini paths can never drift on shape or editorial rules.
- Fixed (2026-07-30): retry with backoff and bounded timeouts for transient
  Gemini disconnects, so a hung run can't run past the Action's time limit.

🎨 Dashboard
- Added: **Claude / Gemini engine tabs** filtering the archive, and an engine tag
  on each issue.

🧰 Tooling
- Added: the scheduled **GitHub Action** (`.github/workflows/pulse.yml`) —
  generates an issue with the Gemini engine and pushes it to `main`, so Vercel
  rebuilds and publishes with no human in the loop.

---

## [v1.0.0] — 2026-06-23 — A private AI-for-business pulse, read like a newspaper

The first complete version: a free Claude Code curation engine, a tiered source
network with grounded summaries, and a warm "Buddy-System" dashboard wearing the
Scribbld **Highlighter & Ink** brand, with the RoboBuddy mascot throughout.

🧠 Engine
- Added: **Claude Code curation engine** — the default, no-API-cost path. Python
  collects RSS candidates for free; a Claude Code session does the web-grounded
  trending + editorial judgment (`/pulse`).
- Added: **Anthropic API engine** as an optional fully-autonomous fallback
  (`curator.py`, ~cents/issue).
- Added: **grounded collection** — RSS collectors plus a `web_search` pass that only
  keeps results with a real, in-window URL; every output item carries a real source.
- Added: **validation + persistence** (`pipeline.py --write`) — re-enforces the rules,
  dedupes near-identical stories, drops `seen_urls`, caps per-section counts, writes the
  dated issue, and rebuilds the index.
- Added: **brief auto-fill by URL** — the Brief lists items by URL and the pipeline
  copies the full card from its section automatically.
- Added: **empty-summary gate** — items without a grounded summary are rejected, so
  nothing ships unexplained.
- Added: `enrich.py` (pass-through seam for a future ROI/case-study layer) and
  `notify.py` (no-op seam for a future "new issue is up" ping).

📡 Sources
- Added: **tiered 16-feed source network** — a ranked, multi-tier RSS roster tuned for
  AI-for-business signal (ops, finance, sales, support, marketing).
- Added: **`case_studies` section** — named company + what they deployed + a measurable
  result. A story with no measurable result is News, not a Case Study.
- Added: **ranked curation priorities** — client-ready talking points first, then the
  reader's learning curve, then market radar. A weaker story she can *use* beats a
  bigger one she can't.
- Added: **card shapes** per section (Brief / case_studies / people) and
  **action-phrased `why_it_matters`** — one sentence she can act on, no clickbait.

🎨 Dashboard
- Added: **React 19 + Vite + TypeScript** dashboard rendering the latest issue with a
  30-second **Brief** up top and an **archive switcher** for past issues.
- Added: **warm-paper redesign** — light tokens, disclosure cards, reading-time chip.
- Added: **self-hosted variable fonts** — Fraunces (display) + Source Sans 3 (text).
- Added: **Buddy-System design language** — a bento "glance" front door, fill-screen
  takeover morph into the issue, view transitions, and an ambient **RoboBuddy** mascot
  (corner, dialogue box, and peeping hover states). Codified view states, motion tokens,
  and mascot rules.
- Added: **Highlighter & Ink** — the Scribbld brand accent layer (gold ink, marker-yellow
  decoration, butter-toned Brief surface) and an RPG dialogue-box masthead with a
  centered RoboBuddy portrait.

🧰 Tooling
- Added: **`/pulse`** slash command — runs the whole flow end-to-end behind `CLAUDE.md`
  guardrails.
- Added: **`pulse-design`** and **`pulse-design-review`** project skills to keep
  dashboard changes on-brand and reviewed.
- Added: **Vercel config** for the frontend Vite app.

[v1.3.0]: https://github.com/amk16/Buddy-System
[v1.2.0]: https://github.com/amk16/Buddy-System
[v1.1.0]: https://github.com/amk16/Buddy-System
[v1.0.0]: https://github.com/amk16/Buddy-System
