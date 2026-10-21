import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useHoldToClear } from "./useHoldToClear";

// The press-and-hold gesture on its own, away from the mark it serves: a short
// press is an ordinary tap, a long one clears and swallows the click the
// browser sends afterwards, and anything that interrupts the press does
// neither.

let container: HTMLDivElement;
let root: Root;
let cleared: number;
let clicked: number;

// The counters are handed in rather than closed over, so nothing inside the
// component reaches out to module scope (react-hooks/globals).
interface HostProps {
  enabled: boolean;
  onClear: () => void;
  onTap: () => void;
}

function Host({ enabled, onClear, onTap }: HostProps) {
  const hold = useHoldToClear({ enabled, onClear });
  return createElement("button", {
    type: "button",
    className: "host",
    "data-holding": hold.holding,
    ...hold.handlers,
    onClick: () => {
      if (hold.consumeHeld()) return;
      onTap();
    },
  });
}

function mount(enabled = true): void {
  act(() =>
    root.render(
      createElement(Host, {
        enabled,
        onClear: () => {
          cleared += 1;
        },
        onTap: () => {
          clicked += 1;
        },
      }),
    ),
  );
}

const host = () => container.querySelector(".host");
const holding = () => host()?.getAttribute("data-holding");

function pointer(type: string, init: PointerEventInit = {}): void {
  act(() => {
    host()?.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        pointerType: "touch",
        ...init,
      }),
    );
  });
}

function click(): void {
  act(() => {
    host()?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function wait(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  cleared = 0;
  clicked = 0;
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

describe("useHoldToClear", () => {
  it("lets a press released before the threshold stay an ordinary tap", () => {
    mount();
    pointer("pointerdown");
    wait(300);
    pointer("pointerup");
    click();

    expect(cleared).toBe(0);
    expect(clicked).toBe(1);
  });

  it("clears on a press held to the threshold, and swallows the click after it", () => {
    mount();
    pointer("pointerdown");
    wait(500);
    pointer("pointerup");
    click();

    expect(cleared).toBe(1);
    expect(clicked).toBe(0);
  });

  it("swallows only the one click the completed hold produced", () => {
    mount();
    pointer("pointerdown");
    wait(500);
    pointer("pointerup");
    click(); // swallowed
    click(); // an ordinary tap again

    expect(clicked).toBe(1);
  });

  it("raises the hold cue only once the press has lasted long enough to mean it", () => {
    mount();
    pointer("pointerdown");
    expect(holding()).toBe("false");

    wait(150);
    expect(holding()).toBe("true");

    pointer("pointerup");
    expect(holding()).toBe("false");
  });

  it("abandons the hold when the pointer is cancelled or wanders off", () => {
    mount();
    pointer("pointerdown");
    wait(300);
    pointer("pointercancel");
    wait(500);

    expect(cleared).toBe(0);
    expect(holding()).toBe("false");

    pointer("pointerdown");
    wait(300);
    // React synthesises onPointerLeave from pointerout, so that is what a
    // wandering finger actually looks like to the handler.
    pointer("pointerout", { relatedTarget: document.body });
    wait(500);
    expect(cleared).toBe(0);
  });

  it("lets the next tap count after a hold that produced no click", () => {
    mount();
    pointer("pointerdown");
    wait(500);
    // No click follows: the finger slid off the button, or Safari swallowed it
    // after the long press. The flag must not survive into the next press.
    pointer("pointerup");

    mount(false); // the control is resting now, so there is nothing to clear
    pointer("pointerdown");
    pointer("pointerup");
    click();

    expect(clicked).toBe(1);
  });

  it("never leaves an orphan timer when a second press arrives mid-hold", () => {
    mount();
    pointer("pointerdown");
    wait(300);
    pointer("pointerdown"); // a second finger lands
    wait(250); // 550ms since the first press, 250ms since the second

    expect(cleared).toBe(0); // the abandoned first press must not fire

    wait(250); // now 500ms since the second
    expect(cleared).toBe(1);
  });

  it("stays out of the way when there is nothing to clear", () => {
    mount(false);
    pointer("pointerdown");
    wait(500);
    pointer("pointerup");
    click();

    expect(cleared).toBe(0);
    expect(holding()).toBe("false");
    expect(clicked).toBe(1); // the tap still climbs
  });

  it("ignores a press that is not the primary button", () => {
    mount();
    pointer("pointerdown", { button: 2 });
    wait(500);

    expect(cleared).toBe(0);
    expect(holding()).toBe("false");
  });

  it("drops its timers when the control goes away mid-press", () => {
    mount();
    pointer("pointerdown");
    act(() => root.unmount());
    root = createRoot(container);
    wait(500);

    expect(cleared).toBe(0);
  });
});
