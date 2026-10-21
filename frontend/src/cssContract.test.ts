import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// jsdom parses CSS but measures nothing and resolves no custom properties, so
// the rules that only a real browser could prove are pinned here as text. They
// are the ones a later edit could quietly undo: the non-colour half of a
// pressed chip, the resting contrast of the heart, the toggle width that keeps
// the heart from moving, and the mobile actions row.

// Read from disk rather than imported: vitest disables CSS processing, so a
// "?raw" import comes back empty. Vitest runs with the Vite root (frontend/) as
// its cwd, so this is the stylesheet the browser is served.
const css = readFileSync("src/index.css", "utf8");

// The whole body of the first rule this selector opens on its own. A match
// preceded by a comma belongs to a grouped selector, which is a different rule.
// The walk is brace aware, so a @keyframes rule comes back entire rather than
// truncated at its first step, which would let a reordered keyframe make an
// assertion pass while saying nothing.
function block(selector: string): string {
  const needle = `\n${selector} {`;
  let at = css.indexOf(needle);
  while (at > 0 && css[at - 1] === ",") at = css.indexOf(needle, at + 1);
  expect(at, `no rule for ${selector}`).toBeGreaterThan(-1);
  let depth = 0;
  let i = at + needle.length - 1;
  for (; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return css.slice(at, i + 1);
}

describe("index.css contract", () => {
  it("gives a pressed reason chip a non-colour twin, not hue alone", () => {
    const pressed = block('.chip[aria-pressed="true"]');
    expect(pressed).toContain("box-shadow: inset 0 0 0 1px var(--accent)");
    expect(pressed).toContain("font-weight: 600");
    // The fill is the same either way now, so shape and weight carry the state
    // on their own and no tint can be mistaken for a signal pill.
    expect(pressed).toContain("background: var(--cream-2)");
    expect(block(".chip")).toContain("background: var(--cream-2)");
    expect(block(".chip")).toContain("font-weight: 400");
  });

  it("shares the pill recipe with the kicker instead of restating it", () => {
    expect(css).toContain(".card-kicker,\n.chip {");
  });

  it("rests the screen at a colour that clears the 3:1 control floor", () => {
    expect(block(".mark-cell")).toContain("fill: #938d7e");
    expect(block(".mark:hover .mark-cell")).toContain("fill: var(--ink-soft)");
  });

  it("lights the whole heart for like, sweeping down one row at a time", () => {
    const boot = block('.mark[data-level="more"] .mark-cell');
    // Green, not gold: deep gold read as brown-grey beside the resting grey.
    expect(boot).toContain("fill: #1f9e6e");
    expect(boot).toContain("transition-delay: calc(var(--r) * 45ms)");
    // Nothing is left unlit: a half-lit heart was too quiet to read.
    expect(css).not.toContain('.mark[data-level="more"] .mark-cell:nth-child(odd)');
  });

  it("glows super like across the whole heart, with a bright core and a deep tip", () => {
    const glow = block('.mark[data-level="loved"] .mark-cell');
    expect(glow).toContain("fill: #f6b53d");
    expect(glow).toContain("transition-delay: calc(var(--d) * 30ms)");
    // The upper left lobe and the centre column carry the marker yellow. They
    // share one grouped rule, which block() deliberately skips, so this reads
    // the group itself.
    const core = css.slice(
      css.indexOf('.mark[data-level="loved"] .mark-cell:nth-child(6),'),
    );
    const coreRule = core.slice(0, core.indexOf("}"));
    expect(coreRule).toContain("nth-child(15)"); // the lower centre column cell
    expect(coreRule).toContain("fill: var(--brand-highlight)");
    // The point at the bottom holds the deep gold.
    expect(block('.mark[data-level="loved"] .mark-cell:nth-child(27)')).toContain(
      "fill: var(--accent)",
    );
  });

  it("makes super like bigger by redrawing the rig, never by scaling it", () => {
    // The size lives in the rig's own geometry (a 2px gap instead of 1px), so
    // there is no persistent transform anywhere: a scaled rig resampled the
    // outline soft and pushed the ink into the mobile gutter.
    expect(css).not.toContain("transform: scale(1.12);\n}");
    // The only transforms left are the one-shot beats.
    const transforms = css.match(/transform: scale\([^)]*\)/g) ?? [];
    const beats = css.slice(css.indexOf("@keyframes mark-beat"));
    for (const t of transforms) {
      expect(beats.includes(t) || t.includes("var(--ring-max)")).toBe(true);
    }
  });

  it("clips the shimmer to the cells rather than to the button", () => {
    const shimmer = block(".mark-shimmer");
    expect(shimmer).toContain("mark-shimmer-sweep 500ms linear");
    expect(shimmer).toContain("opacity: 0");
    // No box of its own any more: it is an SVG rect inside the rig, under a
    // clipPath built from the same 27 cells.
    expect(shimmer).not.toContain("position: absolute");
    expect(shimmer).not.toContain("inset:");
    expect(shimmer).not.toContain("background-image");
  });

  it("beats once at like and twice at super like", () => {
    expect(block('.mark-rig[data-beat="single"]')).toContain(
      "mark-beat 300ms var(--ease-settle)",
    );
    expect(block('.mark-rig[data-beat="double"]')).toContain(
      "mark-beat-double 450ms var(--ease-settle)",
    );
    const double = block("@keyframes mark-beat-double");
    expect(double).toContain("scale(1.18)");
    expect(double).toContain("scale(1.05)");
    // Both beats end where they began. There is no persistent scale to land on
    // any more, and with no fill mode a keyframe that ended anywhere else would
    // snap back to 1 the moment the animation finished.
    expect(double.trimEnd().endsWith("transform: scale(1);\n  }\n}")).toBe(true);
    expect(double).not.toContain("scale(1.12)");
    const single = block("@keyframes mark-beat");
    expect(single.trimEnd().endsWith("transform: scale(1);\n  }\n}")).toBe(true);
  });

  it("indexes every one of the heart's cells for both staggers", () => {
    expect(css).toContain(".mark-cell:nth-child(27) { --r: 5; }");
    expect(css).toContain(".mark-cell:nth-child(27) { --d: 8; }");
    expect(block(".mark-cell")).toContain("transition-delay: 0ms");
  });

  it("gives super like an edge, so the level is not carried by hue alone", () => {
    const base = block(".mark-halo");
    expect(base).toContain("stroke: var(--accent)");
    expect(base).toContain("stroke-width: 1");
    // Static: an edge that moved would be a fourth motion on one landing. It
    // only ever fades, so it neither pops in nor pops out.
    expect(base).not.toContain("animation");
    expect(base).toContain("stroke-opacity: 0");
    expect(base).toContain("transition: stroke-opacity var(--motion-md)");
    expect(block('.mark[data-level="loved"] .mark-halo')).toContain(
      "stroke-opacity: 1",
    );
  });

  it("takes the edge away with the cells while a clearing press is held", () => {
    const held = block('.mark[data-holding="true"][data-level="loved"] .mark-halo');
    expect(held).toContain("stroke-opacity: 0");
    // The same 350ms linear the cells use, so the two leave together instead of
    // the edge surviving until the clear commits and then vanishing.
    expect(held).toContain("transition-duration: 350ms");
    expect(held).toContain("transition-timing-function: linear");
  });

  it("dims the hold at a steady rate, arriving exactly when the clear commits", () => {
    const held = block('.mark[data-holding="true"][data-level] .mark-cell:nth-child(n)');
    // 150ms cue plus 350ms linear lands on the 500ms threshold. On the settle
    // curve the fill looked finished by 300ms and an early release read as a
    // glitch.
    expect(held).toContain("transition-timing-function: linear");
    expect(held).toContain("transition-duration: 350ms");
  });

  it("dims the screen toward rest while a clearing press is being held", () => {
    const held = block('.mark[data-holding="true"][data-level] .mark-cell:nth-child(n)');
    expect(held).toContain("fill: #938d7e");
    expect(held).toContain("transition-duration: 350ms");
    expect(held).toContain("transition-delay: 0ms");
  });

  it("keeps the platform out of the way of the hold gesture", () => {
    const mark = block(".mark");
    expect(mark).toContain("touch-action: manipulation");
    expect(mark).toContain("user-select: none");
    expect(mark).toContain("-webkit-touch-callout: none");
  });

  it("never multiplies the shimmer's opacity below the band's own alpha", () => {
    // The band carries 35% alpha. Fading the element in and out underneath it
    // once put the crest near a tenth of that and the sweep was invisible, so
    // the sweep holds the element at full opacity from end to end.
    const sweep = block("@keyframes mark-shimmer-sweep");
    expect(sweep).toContain("opacity: 1");
    expect(sweep).not.toContain("opacity: 0");
    // A full ink box of travel each way, so the crest walks across the heart
    // instead of flashing past one corner of it.
    expect(sweep).toContain("translate(-40px, -34px)");
    expect(sweep).toContain("translate(40px, 34px)");
  });

  it("holds the Details toggle at one width, with its ink on the text river", () => {
    const toggle = block(".card-toggle");
    expect(toggle).toMatch(/min-inline-size:\s*[\d.]+rem/);
    expect(toggle).toContain("justify-content: flex-end");
    expect(toggle).toContain("padding: 0 0 0 var(--sp-2)");
  });

  it("starts the landing ring visible enough to be seen mid-flight", () => {
    expect(css).toContain("@keyframes mark-ring-fade");
    expect(block("@keyframes mark-ring-fade")).toContain("opacity: 0.55");
    expect(block(".mark-ring")).toContain("mark-ring-fade 400ms linear");
  });

  it("gives the actions their own line on small screens, left with the text", () => {
    const small = css.slice(css.indexOf("@media (max-width: 480px)"));
    const actions = small.slice(small.indexOf("\n  .card-actions {"));
    const decls = actions.slice(0, actions.indexOf("}"));
    expect(decls).toContain("flex-basis: 100%");
    // No negative offset: the heart is two widths at two levels, so no single
    // pull could put all three on the river. The rig left-aligns inside its own
    // button instead.
    expect(decls).toContain("margin-inline-start: 0");
    const markRule = small.slice(small.indexOf("\n  .mark {"));
    expect(markRule.slice(0, markRule.indexOf("}"))).toContain(
      "justify-content: flex-start",
    );
    // The heart leads the group at this width, so it is the ink that lands on
    // the river rather than the landing word.
    expect(markRule.slice(0, markRule.indexOf("}"))).toContain("order: -1");
    // And the halo stops short of the card's padding at this width.
    expect(small.slice(small.indexOf("\n  .mark-ring {"))).toContain("--ring-max: 1.4");
  });

  it("widens the actions gap by 2px so super like doesn't read tighter", () => {
    // The 40x34 super-like rig fills its 40px button edge to edge, losing the
    // inset the smaller sizes carry, so the gap needs 2px added to keep the
    // heart-to-toggle spacing close across all three levels.
    expect(block(".card-actions")).toContain("gap: var(--sp-2)");
  });

  it("rests the boot screen's cells unlit in the face's dim-pixel colour", () => {
    // The same unlit value BuddyPeek's screen uses (lib/buddy.ts OFF), so the
    // cover's screen is that screen at viewport scale.
    const cell = block(".boot-cell");
    expect(cell).toContain("fill: #221d17");
    expect(cell).toContain("transition: fill 160ms var(--ease-settle)");
    expect(cell).toContain("transition-delay: 0ms");
  });

  it("lifts the cover off the top in one eased move, the only transform it owns", () => {
    const cover = block(".boot-cover");
    expect(cover).toContain("transition: transform 1100ms var(--ease-settle)");
    // compositor-only: the shadow is static, never in the transition list
    expect(cover).not.toContain("box-shadow 1100ms");
    expect(block(".boot-cover.lift")).not.toContain("box-shadow");
    // the housing's shadow is a box-shadow on the wrapper, never an SVG filter
    expect(block(".boot-screen")).not.toContain("filter:");
    expect(block(".boot-screen-wrap")).toContain("box-shadow");
    expect(block(".boot-cover.lift")).toContain("transform: translateY(-102%)");
    const start = css.indexOf(".boot-cover {");
    const end = css.indexOf("@keyframes mark-beat");
    expect(start).toBeGreaterThan(-1);
    const slice = start < end ? css.slice(start, end) : css.slice(start);
    expect(slice).not.toContain("transform: scale(");
  });

  it("reserves the slow word's line and fades it, so the cover never hops", () => {
    const word = block(".boot-word");
    expect(word).toContain("min-height: 1.5em");
    expect(word).toContain("opacity: 0");
    expect(word).toContain("transition: opacity var(--motion-md) var(--ease-settle)");
    expect(block('.boot-word[data-show="true"]')).toContain("opacity: 1");
  });

  it("cuts the sunk wordmark at the paper's edge, so nothing hangs below the sheet", () => {
    expect(block(".boot-cover")).toContain("overflow: hidden");
  });

  it("sets the wordmark as the landscape, bottom-anchored and rising once", () => {
    const wm = block(".boot-wordmark");
    expect(wm).toContain("bottom: -0.22em");
    // sized from the viewport, never a fixed vw that can clip the word on phones
    expect(wm).toContain("font-size: clamp(48px, calc((100vw - 2 * var(--sp-4)) / 5.8), 240px)");
    expect(wm).toContain('"opsz" 144');
    expect(wm).toContain("white-space: nowrap");
    expect(wm).toContain("font-family: var(--font-serif)");
    expect(block(".boot-wordmark span")).toContain("animation: boot-rise 900ms var(--ease-settle) forwards");
  });

  it("gives the masthead portrait no transition name: nothing travels any more", () => {
    expect(css).not.toContain('.app[data-boot="exit"]');
    expect(block(".bd-portrait")).not.toContain("view-transition-name");
  });

  it("zeroes the boot cell stagger under reduced motion too", () => {
    const guards = css.split("@media (prefers-reduced-motion: reduce)").slice(1);
    const zeroed = guards.some((g) => {
      const body = g.slice(0, g.indexOf("\n}\n"));
      return body.includes(".boot-cell") && body.includes("transition-delay: 0ms !important");
    });
    expect(zeroed).toBe(true);
  });

  it("carries the real Scribbld highlight and nothing of the old yellow", () => {
    expect(css).toContain("--brand-highlight: #f78d1d");
    expect(css).not.toContain("brand-yellow");
    // ink ON the highlight is the one text use (5.9:1); the highlight itself is never text
    const plate = block(".bd-nameplate");
    expect(plate).toContain("background: var(--brand-highlight)");
    expect(plate).toContain("color: var(--ink)");
  });

  it("holds the masthead row at the portrait's height, by choice", () => {
    const portrait = block(".bd-portrait");
    expect(portrait).toContain("width: 112px");
    expect(portrait).toContain("height: 112px");
    expect(block(".bd-box")).toContain("min-height: 112px");
    expect(block(".bd-box")).toContain("background: var(--card)");
  });

  it("keeps one rhythm on the front door", () => {
    expect(block(".glance")).toContain("gap: var(--sp-5)");
    expect(block(".glance-bento")).toContain("gap: var(--sp-5)");
    expect(block(".brief")).toContain("padding: var(--sp-5);");
  });

  it("spends a section's hue only on reach, and the takeover's as a band", () => {
    expect(block(".tile-sig")).toContain("background: var(--card)");
    expect(block(".tile-sig:hover,\n.tile-sig:focus-within")).toContain("box-shadow: inset 3px 0 0 var(--sig)");
    expect(block(".tile-sig:hover .tile-label,\n.tile-sig:focus-within .tile-label")).toContain("color: var(--sig)");
    expect(block(".takeover")).toContain("background: var(--paper)");
    // the band is gone; the hue is the sliver's lower half above the label
    expect(css).not.toContain("\n.takeover::before {");
    expect(css).not.toContain("honeycomb");
    const rule = block(".takeover .section-label::before");
    expect(rule).toContain("width: var(--sp-8)");
    expect(rule).toContain("linear-gradient(to bottom, var(--ink) 60%, var(--sig) 60%)");
    expect(block(".takeover .section-label")).toContain("color: var(--ink)");
    // tiles: the ink/highlight sliver at rest, its lower half in the hue on reach; the feed keeps its sliver
    expect(block(".tile-sig:hover::before,\n.tile-sig:focus-within::before")).toContain("linear-gradient(to bottom, var(--ink) 60%, var(--sig) 60%)");
    expect(block(".section-label::before")).toContain("linear-gradient(to bottom, var(--ink) 60%, var(--brand-highlight) 60%)");
  });

  it("keeps the hero tile's safe zone on hover devices, on the grid", () => {
    expect(css).not.toContain("76px");
    const hoverBlocks = css.split("@media (hover: hover)").slice(1);
    expect(hoverBlocks.some((b) => b.slice(0, b.indexOf("\n}\n")).includes(".tile-wide {\n    padding-right: 72px;"))).toBe(true);
  });

  it("collapses the two-column glance at 900px, where half tiles stop holding text", () => {
    const at = css.indexOf("@media (max-width: 900px)");
    expect(at).toBeGreaterThan(-1);
    const body = css.slice(at, css.indexOf("\n}\n", at));
    expect(body).toContain(".glance {\n    grid-template-columns: 1fr;");
    // the 560 block no longer carries the glance collapse, only the bento's
    const small = css.slice(css.indexOf("@media (max-width: 560px)"));
    expect(small.slice(0, small.indexOf("\n}\n"))).not.toContain(".glance {");
  });

  it("fits the glance Brief to the wall: stretched to the row, items clamped to three lines", () => {
    expect(block(".glance .brief")).toContain("align-self: stretch");
    expect(block(".glance-bento")).toContain("align-self: stretch");
    expect(block(".glance-bento")).toContain("align-content: space-between");
    const clamp = block(".glance .brief-text");
    expect(clamp).toContain("-webkit-line-clamp: 3");
    expect(clamp).toContain("overflow: hidden");
  });

  it("centres RoboBuddy whole in the portrait frame", () => {
    const img = block(".bd-portrait-img");
    expect(img).toContain("width: 105%");
    expect(img).toContain("left: 10.4%");
    expect(img).toContain("top: -23.3%");
    expect(block(".bd-portrait")).toContain("position: relative");
  });

  it("rules the feed's sections apart with register tape", () => {
    const tape = block(".section + .section");
    expect(tape).toContain("repeating-linear-gradient");
    expect(tape).toContain("background-size: 100% 3px");
  });

  it("zeroes the cell stagger delay under reduced motion", () => {
    // The file carries more than one reduced-motion block; one of them has to
    // kill the stagger, because the global rule only collapses duration.
    const guards = css.split("@media (prefers-reduced-motion: reduce)").slice(1);
    const zeroed = guards.some((g) =>
      g.slice(0, g.indexOf("\n}\n")).includes("transition-delay: 0ms !important"),
    );
    expect(zeroed).toBe(true);
  });
});
