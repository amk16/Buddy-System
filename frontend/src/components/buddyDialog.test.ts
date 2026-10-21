import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BuddyDialog } from "./BuddyDialog";

// The masthead greeting types once on load. While the boot cover is up it must
// wait, so the words are not typed unseen behind the cover.

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
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

function render(paused: boolean): void {
  act(() =>
    root.render(
      createElement(BuddyDialog, {
        name: "Kajol",
        portraitSrc: "/robobuddy.png",
        paused,
      }),
    ),
  );
}

const typed = () => container.querySelector(".bd-text [aria-hidden]")?.textContent ?? "";

describe("BuddyDialog typewriter", () => {
  it("types on its own when not paused", () => {
    render(false);
    expect(typed()).toBe("");
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(typed().length).toBeGreaterThan(10);
  });

  it("types nothing while paused", () => {
    render(true);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(typed()).toBe("");
    // no bare caret in an empty line while the cover is up: the box is at rest
    expect(container.querySelector(".bd-cursor")).toBeNull();
  });

  it("starts typing from the first character once unpaused", () => {
    render(true);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    render(false);
    act(() => {
      vi.advanceTimersByTime(90);
    });
    expect(typed().length).toBe(3);
  });

  it("survives a browser with no matchMedia", () => {
    // jsdom has none by default, and the component must not throw on mount.
    expect(() => render(false)).not.toThrow();
  });
});
