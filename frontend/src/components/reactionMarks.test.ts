import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { FeedbackEvent, Item } from "../lib/types";
import * as feedback from "../lib/feedback";
import * as reactions from "../lib/reactions";
import { ItemCard } from "./ItemCard";

// One pixel heart per card: tap to climb none -> like -> super like, hold or
// press Delete to clear. Mounted inside a real ItemCard, driven by real events,
// asserted on the DOM and on the queued feedback. No JSX so the file stays a
// .ts and matches the runner's include pattern.

const QUEUE_KEY = "pulse.feedback.v1";
const STORE_KEY = "pulse.reactions.v1";
const ISSUE = "2026-09-22";

const item: Item = {
  section: "tools",
  headline: "A tool that does a thing",
  summary: "Two plain sentences about the thing.",
  why_it_matters: "Pitch it to retail clients.",
  terms: [],
  url: "https://example.com/tool",
  source_name: "Example",
  signal_tag: "new",
};

function queue(): FeedbackEvent[] {
  const raw = localStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as FeedbackEvent[]) : [];
}

function kinds(): string[] {
  return queue()
    .filter((e) => e.url === item.url && e.kind !== "open")
    .map((e) => e.kind);
}

let container: HTMLDivElement;
let root: Root;
const swallow = (e: MouseEvent) => e.preventDefault();

beforeEach(() => {
  localStorage.clear();
  feedback._resetForTests();
  reactions._resetForTests();
  vi.useFakeTimers();
  feedback.setContext({ issue_id: ISSUE, engine: "claude" });
  reactions.setIssue(ISSUE);
  container = document.createElement("div");
  document.body.appendChild(container);
  document.addEventListener("click", swallow);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.removeEventListener("click", swallow);
  container.remove();
  vi.useRealTimers();
  // The reduced-motion cases install one; jsdom has none of its own.
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

function render(): void {
  act(() => root.render(createElement(ItemCard, { item })));
}

const mark = () => container.querySelector(".mark");
const level = () => mark()?.getAttribute("data-level");
const label = () => mark()?.getAttribute("aria-label");
const ring = () => container.querySelector(".mark-ring");
const shimmer = () => container.querySelector(".mark-shimmer");
const status = () => container.querySelector('[role="status"]');
const rig = () => container.querySelector(".mark-rig");
const beating = () => rig()?.getAttribute("data-beat");

function tap(): void {
  act(() => {
    mark()?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function pointer(type: string, init: PointerEventInit = {}): void {
  act(() => {
    mark()?.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        pointerType: "touch",
        ...init,
      }),
    );
  });
}

function press(key: string): void {
  act(() => {
    mark()?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

function wait(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function endAnimations(): void {
  for (const el of Array.from(
    container.querySelectorAll(".mark-ring, .mark-shimmer, .mark-rig"),
  )) {
    act(() => {
      el.dispatchEvent(new Event("animationend", { bubbles: true }));
    });
  }
}

function reduceMotion(): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => ({ matches: true }),
  });
}

describe("ReactionMark", () => {
  it("is one heart at rest, with every one of its cells drawn", () => {
    render();
    expect(container.querySelectorAll(".mark")).toHaveLength(1);
    // The 7x6 heart: 4 + 7 + 7 + 5 + 3 + 1 across its six rows.
    expect(container.querySelectorAll(".mark-cell")).toHaveLength(27);
    expect(level()).toBe("none");
    expect(label()).toBe("Like this");
    // Three states, so the button is not a two-state toggle.
    expect(mark()?.hasAttribute("aria-pressed")).toBe(false);
    // A title would raise the platform callout over the hold gesture.
    expect(mark()?.hasAttribute("title")).toBe(false);
    expect(mark()?.getAttribute("aria-description")).toBe(
      "Tap to raise. Press and hold, or press Delete, to clear.",
    );
  });

  it("climbs none to like to super like on taps, relabelling each time", () => {
    render();

    tap();
    expect(level()).toBe("more");
    expect(label()).toBe("Like this, liked");

    tap();
    expect(level()).toBe("loved");
    expect(label()).toBe("Like this, super liked");
    expect(kinds()).toEqual(["undo", "more", "undo", "loved"]);
  });

  it("answers a tap at the top with the shimmer alone, and says nothing new", () => {
    render();
    tap();
    tap(); // super like
    endAnimations();
    const before = kinds().length;
    expect(shimmer()).toBeNull();
    expect(ring()).toBeNull();

    tap();
    expect(level()).toBe("loved");
    expect(shimmer()).not.toBeNull(); // the screen still answers
    expect(ring()).toBeNull(); // but the landing halo is not replayed
    expect(kinds()).toHaveLength(before); // and nothing new is recorded
  });

  it("beats once at like, and rings, shimmers and double beats at super like", () => {
    render();

    tap();
    // Like gets a beat of its own, but neither overlay.
    expect(beating()).toBe("single");
    expect(ring()).toBeNull();
    expect(shimmer()).toBeNull();

    tap();
    const halo = ring();
    expect(halo).not.toBeNull();
    expect(halo?.getAttribute("aria-hidden")).toBe("true");
    expect(mark()?.contains(halo as Node)).toBe(true);
    // The band is drawn inside the rig and clipped to the cells, so it can
    // never wash over the gaps or the button's empty corners.
    expect(rig()?.contains(shimmer() as Node)).toBe(true);
    expect(shimmer()?.closest("[clip-path]")).not.toBeNull();
    expect(beating()).toBe("double");

    endAnimations();
    expect(ring()).toBeNull();
    expect(shimmer()).toBeNull();
    // The heart stays on screen; only its beat is over.
    expect(rig()).not.toBeNull();
    expect(beating()).toBe("off");
  });

  it("ignores a bubbled animationend from inside the rig, only clearing on its own", () => {
    render();
    tap(); // like -> single beat
    expect(beating()).toBe("single");

    // A child of the svg (the rig) firing animationend bubbles up to the same
    // listener the rig's own beat uses; it must not be mistaken for the beat
    // ending.
    act(() => {
      rig()
        ?.querySelector(".mark-cell")
        ?.dispatchEvent(new Event("animationend", { bubbles: true }));
    });
    expect(beating()).toBe("single");

    act(() => {
      rig()?.dispatchEvent(new Event("animationend", { bubbles: true }));
    });
    expect(beating()).toBe("off");
  });

  it("swaps to a bigger rig at super like instead of scaling one", () => {
    render();
    tap();
    expect(rig()?.getAttribute("viewBox")).toBe("0 0 34 29");

    tap(); // super like
    // Same 27 cells, a 2px gap instead of 1px: every edge stays on a whole
    // pixel, which a transform would have resampled.
    expect(rig()?.getAttribute("viewBox")).toBe("0 0 40 34");
    expect(container.querySelectorAll(".mark-cell")).toHaveLength(27);
  });

  it("draws the super-like outline symmetric around the cell block, not flush on two sides only", () => {
    render();
    tap();
    tap(); // super like

    const halo = container.querySelector(".mark-halo");
    const d = halo?.getAttribute("d") ?? "";
    const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(xs.length).toBeGreaterThan(0);

    // The large rig's ink runs 0..40 across and 0..34 down (the viewBox
    // asserted above). A stroke centred half a pixel outside the cell block on
    // every side reads as one even ring, 42x36 outer edge to outer edge,
    // rather than flush on the top/left and gapped on the bottom/right.
    const [w, h] = [40, 34];
    const leftGap = 0 - Math.min(...xs);
    const rightGap = Math.max(...xs) - w;
    const topGap = 0 - Math.min(...ys);
    const bottomGap = Math.max(...ys) - h;
    expect(leftGap).toBeCloseTo(0.5, 5);
    expect(rightGap).toBeCloseTo(leftGap, 5);
    expect(topGap).toBeCloseTo(0.5, 5);
    expect(bottomGap).toBeCloseTo(topGap, 5);
  });

  it("keeps the hold cue on a super liked heart, so the outline can go with it", () => {
    render();
    tap();
    tap(); // super like

    pointer("pointerdown");
    wait(150);
    expect(mark()?.getAttribute("data-holding")).toBe("true");
    expect(mark()?.getAttribute("data-level")).toBe("loved");

    pointer("pointerup");
    expect(mark()?.getAttribute("data-holding")).toBe("false");
  });

  it("clears on a held press, sending undo alone and swallowing the click", () => {
    render();
    tap();
    tap(); // super like

    pointer("pointerdown");
    wait(500);
    pointer("pointerup");
    tap(); // the click the browser sends after the hold

    expect(level()).toBe("none");
    expect(kinds()).toEqual(["undo", "more", "undo", "loved", "undo"]);
  });

  it("shows the hold cue while the press is being made", () => {
    render();
    tap();
    expect(mark()?.getAttribute("data-holding")).toBe("false");

    pointer("pointerdown");
    wait(150);
    expect(mark()?.getAttribute("data-holding")).toBe("true");

    pointer("pointerup");
    expect(mark()?.getAttribute("data-holding")).toBe("false");
  });

  it("climbs instead when the press is released early", () => {
    render();
    tap(); // like

    pointer("pointerdown");
    wait(300);
    pointer("pointerup");
    tap();

    expect(level()).toBe("loved");
  });

  it("never starts a hold on a resting screen", () => {
    render();
    pointer("pointerdown");
    wait(500);
    pointer("pointerup");
    tap();

    // The press was only ever a tap, so the screen climbed.
    expect(level()).toBe("more");
  });

  it("clears from the keyboard with Delete or Backspace", () => {
    render();
    tap();
    press("Delete");
    expect(level()).toBe("none");
    expect(status()?.textContent).toBe("Cleared");

    tap();
    press("Backspace");
    expect(level()).toBe("none");

    // Any other key leaves the screen alone.
    tap();
    press("Escape");
    expect(level()).toBe("more");
  });

  it("announces Noted, empties the slot after 1.2s, and says Cleared on a clear", () => {
    render();
    expect(status()?.textContent).toBe("");

    tap();
    expect(status()?.textContent).toBe("Noted");
    wait(1200);
    expect(status()?.textContent).toBe("");

    press("Delete");
    expect(status()?.textContent).toBe("Cleared");
    wait(1200);
    expect(status()?.textContent).toBe("");
  });

  it("still answers a tap at the top when motion is off", () => {
    reduceMotion();
    render();
    tap();
    tap(); // super like
    wait(1200); // let the landing word clear
    const before = kinds().length;

    tap();
    // No shimmer to see, so the answer has to be the word and the live region.
    expect(shimmer()).toBeNull();
    expect(beating()).toBe("off");
    expect(status()?.textContent).toBe("Noted");
    expect(kinds()).toHaveLength(before);
  });

  it("shows the stored level on the very first render, with no motion", () => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        [ISSUE]: {
          touched: "2026-09-22T10:00:00.000Z",
          urls: { [item.url]: { level: "loved", reasons: [] } },
        },
      }),
    );
    render();

    expect(level()).toBe("loved");
    expect(label()).toBe("Like this, super liked");
    // A reopened card is a restored state, not a landing.
    expect(ring()).toBeNull();
    expect(shimmer()).toBeNull();
    expect(beating()).toBe("off");
  });

  it("skips the halo and the shimmer under reduced motion, but still clears", () => {
    reduceMotion();
    render();
    tap();
    tap(); // super like

    expect(level()).toBe("loved");
    expect(ring()).toBeNull();
    expect(shimmer()).toBeNull();
    expect(beating()).toBe("off");

    pointer("pointerdown");
    wait(500);
    pointer("pointerup");
    expect(level()).toBe("none");
  });
});
