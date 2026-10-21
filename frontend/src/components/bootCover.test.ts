import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BootCover } from "./BootCover";
import { BOOT_PHASES, CELL_COUNT, INTRO_MS } from "../lib/boot";
import { PENCIL_CELLS } from "../lib/pencil";

// The boot cover, "Self-test": RoboBuddy's 11x7 screen boots (raster sweep,
// noise, the face, one blink), a readout counts in the corner, the wordmark
// sits at the bottom edge, and the sheet lifts off the top. Asserted on the
// DOM with fake timers. No JSX so the file stays a .ts and matches the
// runner's include pattern.

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function render(props: Record<string, unknown> = {}): void {
  act(() => root.render(createElement(BootCover, { dateText: "Wed 21 Oct 2026", ...props })));
}

const cover = () => container.querySelector(".boot-cover");
const lit = () =>
  Array.from(container.querySelectorAll<SVGRectElement>(".boot-cell")).filter((c) => c.style.fill !== "");

describe("BootCover", () => {
  it("draws the screen at pencil resolution, 33x21, every cell present and unlit at first", () => {
    render();
    expect(container.querySelectorAll(".boot-cell").length).toBe(CELL_COUNT);
    expect(CELL_COUNT).toBe(693);
    expect(lit().length).toBe(0);
    expect(cover()?.getAttribute("data-phase")).toBe("dark");
  });

  it("boots in order: scan, noise, draw, then holds with the pencil and its written cell lit", () => {
    render();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(cover()?.getAttribute("data-phase")).toBe("scan");
    // the noise phase begins when the sweep's last cell has dwelt and gone out
    const noiseAt = 20 + CELL_COUNT * BOOT_PHASES.scan.step + BOOT_PHASES.scan.dwell;
    act(() => {
      vi.advanceTimersByTime(noiseAt - 100 + 20);
    });
    expect(cover()?.getAttribute("data-phase")).toBe("noise");
    act(() => {
      vi.advanceTimersByTime(INTRO_MS);
    });
    expect(cover()?.getAttribute("data-phase")).toBe("hold");
    // the pencil plus the one cell its point wrote, nothing else lit
    expect(lit().length).toBe(PENCIL_CELLS.length + 1);
    // one orange in three bands, and the heart's grey for the lead and the written cell
    expect(lit().every((c) => /^#(f78d1d|faa733|ffc24a|938d7e)$/i.test(toHex(c.style.fill)))).toBe(true);
    const fills = lit().map((c) => toHex(c.style.fill).toLowerCase());
    const inkInPencil = PENCIL_CELLS.filter(([, , f]) => f === "#938d7e").length;
    expect(inkInPencil).toBeGreaterThan(0);
    expect(fills.filter((f) => f === "#938d7e").length).toBe(inkInPencil + 1);
    expect(fills.filter((f) => f === "#f78d1d").length).toBeGreaterThan(30);
  });

  it("sets the wordmark as twelve rising letters", () => {
    render();
    const letters = container.querySelectorAll(".boot-wordmark span");
    expect(letters.length).toBe("Buddy-System".length);
    expect(container.querySelector(".boot-wordmark")?.textContent).toBe("Buddy-System");
  });

  it("stamps the issue's date and reading time, and nothing before the issue is in", () => {
    render({ dateText: undefined });
    expect(container.querySelector(".boot-stamp")).toBeNull();
    render({ dateText: "Wed 21 Oct 2026", statsText: "9 min skim · 23 min full read" });
    expect(container.querySelector(".boot-stamp")?.textContent).toBe("Wed 21 Oct 20269 min skim · 23 min full read");
  });

  it("never shows 100 while waiting: the last digit belongs to the lift", () => {
    render();
    act(() => {
      vi.advanceTimersByTime(INTRO_MS * 3);
    });
    // the readout is written to the DOM by the frame loop, never via state
    const pct = () => container.querySelector(".boot-pct")?.textContent;
    expect(Number(pct())).toBeLessThanOrEqual(99);
    render({ leaving: true });
    expect(pct()).toBe("100");
  });

  it("shows its one quiet word only when the wait has gone long", () => {
    render();
    const word = () => container.querySelector(".boot-word");
    expect(word()?.textContent).toBe("");
    expect(word()?.getAttribute("data-show")).toBe("false");
    render({ slow: true });
    expect(word()?.textContent).toBe("Loading…");
    expect(word()?.getAttribute("data-show")).toBe("true");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Still loading today's pulse");
  });

  it("drops the slow word the moment the sheet lifts, so it never sits beside 100", () => {
    render({ slow: true, leaving: true });
    expect(container.querySelector(".boot-word")?.getAttribute("data-show")).toBe("false");
    expect(container.querySelector(".boot-pct")?.textContent).toBe("100");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Loading today's pulse");
  });

  it("keeps every decorative part out of the accessibility tree", () => {
    render();
    for (const sel of [".boot-screen", ".boot-readout", ".boot-stamp", ".boot-wordmark", ".boot-grain"]) {
      expect(container.querySelector(sel)?.getAttribute("aria-hidden"), sel).toBe("true");
    }
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Loading today's pulse");
  });

  it("lifts on request and reports when the sheet has cleared", () => {
    const onLeft = vi.fn();
    render({ leaving: false, onLeft });
    expect(cover()?.classList.contains("lift")).toBe(false);
    render({ leaving: true, onLeft });
    expect(cover()?.classList.contains("lift")).toBe(true);
    expect(onLeft).not.toHaveBeenCalled();
    // jsdom fires no transitionend; the fallback timer settles it
    act(() => {
      vi.advanceTimersByTime(BOOT_PHASES.lift + 200);
    });
    expect(onLeft).toHaveBeenCalledTimes(1);
  });

  it("leaves nothing ticking after an early unmount", () => {
    render();
    act(() => root.unmount());
    expect(() => {
      vi.advanceTimersByTime(INTRO_MS * 2);
    }).not.toThrow();
    root = createRoot(container);
  });
});

function toHex(fill: string): string {
  const m = fill.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return fill;
  return "#" + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("");
}
