import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { FeedbackEvent, Item } from "../lib/types";
import * as feedback from "../lib/feedback";
import * as reactions from "../lib/reactions";
import { ItemCard } from "./ItemCard";
import { Brief } from "./Brief";

// The Why row: the chips that turn a reaction into something the curator can
// act on, and the disclosure rules they change on the card around them. Only
// the positive set is reachable now, because the card no longer carries a
// dislike.

const QUEUE_KEY = "pulse.feedback.v1";
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

// No summary, no terms: on its own this card has nothing to disclose.
const bare: Item = {
  ...item,
  summary: undefined,
  terms: [],
  url: "https://example.com/bare",
};

function queue(): FeedbackEvent[] {
  const raw = localStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as FeedbackEvent[]) : [];
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
});

function render(which: Item = item): void {
  act(() => root.render(createElement(ItemCard, { item: which })));
}

function click(el: Element | null): void {
  act(() => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

// One tap on the card's single Pixel Screen: none -> like -> super like.
function tapMark(): void {
  click(container.querySelector(".mark"));
}

function press(key: string): void {
  act(() => {
    container
      .querySelector(".mark")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

const chips = () => Array.from(container.querySelectorAll(".chip"));
const toggle = () => container.querySelector(".card-toggle");
const detail = () => container.querySelector(".card-detail");

describe("ReasonChips", () => {
  it("keeps the collapsed detail panel out of the Tab order with inert", () => {
    render();
    expect(detail()?.hasAttribute("inert")).toBe(true);

    click(toggle());
    expect(detail()?.hasAttribute("inert")).toBe(false);
  });

  it("renames the open toggle to Hide, so the row never reads Less twice", () => {
    render();
    expect(toggle()?.textContent).toContain("Details");
    click(toggle());
    expect(toggle()?.textContent).toContain("Hide");
    expect(toggle()?.textContent).not.toContain("Less");
  });

  it("shows no Why row until there is a reaction to explain", () => {
    render();
    click(toggle());
    expect(chips()).toHaveLength(0);
  });

  it("shows the same five positive chips at like and at super like", () => {
    render();
    click(toggle());
    const positive = [
      "Client-ready",
      "Taught me something",
      "Good numbers",
      "Worth following",
      "My industry",
    ];

    tapMark(); // like
    expect(chips().map((c) => c.textContent)).toEqual(positive);

    tapMark(); // super like
    expect(chips().map((c) => c.textContent)).toEqual(positive);
  });

  it("resends undo then the reaction carrying the reason when a chip is pressed", () => {
    render();
    click(toggle());
    tapMark();

    click(chips()[0]);
    expect(chips()[0].getAttribute("aria-pressed")).toBe("true");

    const own = queue().filter((e) => e.url === item.url && e.kind !== "open");
    expect(own.map((e) => e.kind)).toEqual(["undo", "more", "undo", "more"]);
    expect(own[3].reasons).toEqual(["client_ready"]);
    expect(own[3].section).toBe("tools");
  });

  it("still shows a lit chip after the card is remounted", () => {
    render();
    click(toggle());
    tapMark();
    click(chips()[2]); // Good numbers

    act(() => root.unmount());
    root = createRoot(container);
    render();
    click(toggle());

    const lit = chips().filter((c) => c.getAttribute("aria-pressed") === "true");
    expect(lit.map((c) => c.textContent)).toEqual(["Good numbers"]);
  });

  it("gives a card with nothing to disclose a toggle once it has been reacted to", () => {
    render(bare);
    expect(toggle()).toBeNull();
    expect(detail()).toBeNull();

    tapMark();
    expect(toggle()).not.toBeNull();

    click(toggle());
    expect(chips()).toHaveLength(5);
  });

  it("never brings a bare card's panel back already open", () => {
    render(bare);
    tapMark();
    click(toggle()); // open
    expect(detail()?.getAttribute("data-open")).toBe("true");

    tapMark(); // super like
    press("Delete"); // cleared: nothing left to show
    expect(detail()).toBeNull();

    tapMark(); // marked again
    expect(detail()?.getAttribute("data-open")).toBe("false");
    expect(detail()?.hasAttribute("inert")).toBe(true);
    expect(toggle()?.textContent).toContain("Details");
  });
});

describe("Brief", () => {
  it("carries no marks: the Brief never holds controls", () => {
    act(() => root.render(createElement(Brief, { items: [item] })));
    expect(container.querySelector(".mark")).toBeNull();
    expect(container.querySelector(".chip")).toBeNull();
  });
});
