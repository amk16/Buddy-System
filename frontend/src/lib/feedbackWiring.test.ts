import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { FeedbackEvent, Item } from "./types";
import * as feedback from "./feedback";
import { ItemCard } from "../components/ItemCard";
import { Brief } from "../components/Brief";

// These cases prove the two silent signals are actually wired to the cards:
// expanding Details once and following a headline. No JSX here so the file can
// stay a .ts and match the runner's include pattern.

const QUEUE_KEY = "pulse.feedback.v1";

function queue(): FeedbackEvent[] {
  const raw = localStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as FeedbackEvent[]) : [];
}

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

let container: HTMLDivElement;
let root: Root;
// Anchors in jsdom cannot navigate; swallow the default so it stays quiet.
const swallow = (e: MouseEvent) => e.preventDefault();

beforeEach(() => {
  localStorage.clear();
  feedback._resetForTests();
  feedback.setContext({ issue_id: "2026-09-22", engine: "gemini" });
  // Keep the flush out of it — these cases only care about what was recorded.
  vi.useFakeTimers();
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

function click(el: Element | null): void {
  act(() => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

describe("ItemCard", () => {
  it("records one open the first time Details is expanded, and never again", () => {
    act(() => root.render(createElement(ItemCard, { item })));
    const toggle = container.querySelector(".card-toggle");

    click(toggle); // open
    click(toggle); // close
    click(toggle); // open again

    const opens = queue().filter((e) => e.kind === "open");
    expect(opens).toHaveLength(1);
    expect(opens[0].url).toBe(item.url);
    expect(opens[0].section).toBe("tools");
    expect(opens[0].issue_id).toBe("2026-09-22");
  });

  it("still records only one open after the card is remounted", () => {
    act(() => root.render(createElement(ItemCard, { item })));
    click(container.querySelector(".card-toggle"));

    // A fresh mount (navigating away and back) must not log a second open —
    // the lib remembers the url, not the component instance.
    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(createElement(ItemCard, { item })));
    click(container.querySelector(".card-toggle"));

    expect(queue().filter((e) => e.kind === "open")).toHaveLength(1);
  });

  it("records a click when the headline is followed", () => {
    act(() => root.render(createElement(ItemCard, { item })));
    click(container.querySelector(".card-headline"));

    const clicks = queue().filter((e) => e.kind === "click");
    expect(clicks).toHaveLength(1);
    expect(clicks[0].url).toBe(item.url);
    expect(clicks[0].section).toBe("tools");
  });
});

describe("Brief", () => {
  it("records a click on a brief link", () => {
    act(() => root.render(createElement(Brief, { items: [item] })));
    click(container.querySelector(".brief-list a"));

    const clicks = queue().filter((e) => e.kind === "click");
    expect(clicks).toHaveLength(1);
    expect(clicks[0].url).toBe(item.url);
    expect(clicks[0].section).toBe("tools");
  });
});
