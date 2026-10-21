import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedbackEvent } from "./types";
import * as feedback from "./feedback";

const QUEUE_KEY = "pulse.feedback.v1";
const CLIENT_KEY = "pulse.client.v1";

// The queue as the module left it in localStorage.
function storedQueue(): FeedbackEvent[] {
  const raw = localStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as FeedbackEvent[]) : [];
}

// A resolved Response-alike; only `ok` matters to the module.
function res(ok: boolean, status = ok ? 204 : 403) {
  return Promise.resolve({ ok, status } as Response);
}

// The events inside a JSON body the module handed to fetch.
function eventsIn(body: string): FeedbackEvent[] {
  return (JSON.parse(body) as { v: number; events: FeedbackEvent[] }).events;
}

// The RequestInit of the nth fetch call.
function initOf(mock: { mock: { calls: unknown[][] } }, n = 0): RequestInit {
  return mock.mock.calls[n][1] as RequestInit;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  feedback._resetForTests();
  vi.stubEnv("DEV", false);
  vi.stubEnv("VITE_FEEDBACK_ENDPOINT", "/api/feedback");
  feedback.setContext({ issue_id: "2026-09-22", engine: "gemini" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("record", () => {
  it("fills v/id/ts/client_id and the context, and keeps the input's own fields", () => {
    feedback.record({ kind: "open", url: "https://example.com/a", section: "tools" });

    const [ev] = storedQueue();
    expect(ev.v).toBe(1);
    expect(ev.id).toMatch(/\S/);
    expect(ev.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(ev.client_id).toMatch(/\S/);
    expect(ev.issue_id).toBe("2026-09-22");
    expect(ev.engine).toBe("gemini");
    expect(ev.kind).toBe("open");
    expect(ev.url).toBe("https://example.com/a");
    expect(ev.section).toBe("tools");
  });

  it("lets the input override the context", () => {
    feedback.record({ kind: "click", url: "https://example.com/a", issue_id: "2026-01-01", engine: "claude" });
    const [ev] = storedQueue();
    expect(ev.issue_id).toBe("2026-01-01");
    expect(ev.engine).toBe("claude");
  });

  it("uses one stable client_id across records and persists it", () => {
    feedback.record({ kind: "open", url: "https://example.com/a" });
    feedback.record({ kind: "click", url: "https://example.com/b" });

    const [first, second] = storedQueue();
    expect(first.client_id).toBe(second.client_id);
    expect(localStorage.getItem(CLIENT_KEY)).toBe(first.client_id);
    expect(first.id).not.toBe(second.id);
  });

  it("caps the queue at 200 and drops the oldest", () => {
    for (let i = 0; i < 205; i++) {
      feedback.record({ kind: "click", url: `https://example.com/${i}` });
    }
    const queue = storedQueue();
    expect(queue).toHaveLength(feedback.MAX_QUEUE);
    expect(queue[0].url).toBe("https://example.com/5");
    expect(queue[queue.length - 1].url).toBe("https://example.com/204");
  });
});

describe("record: one open per card", () => {
  it("keeps only the first open for a url, however often the card is expanded", () => {
    feedback.record({ kind: "open", url: "https://example.com/a", section: "tools" });
    feedback.record({ kind: "open", url: "https://example.com/a", section: "tools" });
    feedback.record({ kind: "open", url: "https://example.com/b" });

    expect(storedQueue().filter((e) => e.kind === "open")).toHaveLength(2);
  });

  it("does not deduplicate the other kinds", () => {
    feedback.record({ kind: "click", url: "https://example.com/a" });
    feedback.record({ kind: "click", url: "https://example.com/a" });
    expect(storedQueue()).toHaveLength(2);
  });

  it("forgets the opened cards when a new issue is loaded", () => {
    feedback.record({ kind: "open", url: "https://example.com/a" });
    feedback.setContext({ issue_id: "2026-09-23", engine: "gemini" });
    feedback.record({ kind: "open", url: "https://example.com/a" });

    expect(storedQueue()).toHaveLength(2);
  });

  it("keeps the opened set when the same issue is set again", () => {
    feedback.record({ kind: "open", url: "https://example.com/a" });
    feedback.setContext({ issue_id: "2026-09-22", engine: "gemini" });
    feedback.record({ kind: "open", url: "https://example.com/a" });

    expect(storedQueue()).toHaveLength(1);
  });
});

describe("flush", () => {
  it("sends up to 50 events by fetch and removes only those ids", async () => {
    const fetchMock = vi.fn(() => res(true));
    vi.stubGlobal("fetch", fetchMock);

    for (let i = 0; i < 60; i++) {
      feedback.record({ kind: "click", url: `https://example.com/${i}` });
    }
    const before = storedQueue();
    feedback.flush();

    const batch = eventsIn(initOf(fetchMock).body as string);
    expect(batch).toHaveLength(feedback.FLUSH_BATCH);
    expect(batch.map((e) => e.id)).toEqual(before.slice(0, 50).map((e) => e.id));

    await vi.advanceTimersByTimeAsync(0);
    const after = storedQueue();
    expect(after).toHaveLength(10);
    expect(after.map((e) => e.id)).toEqual(before.slice(50).map((e) => e.id));
  });

  it("posts with keepalive to the configured endpoint", async () => {
    const fetchMock = vi.fn(() => res(true));
    vi.stubGlobal("fetch", fetchMock);

    feedback.record({ kind: "click", url: "https://example.com/a" });
    feedback.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = (fetchMock.mock.calls[0] as unknown as unknown[])[0] as string;
    const init = initOf(fetchMock);
    expect(url).toBe("/api/feedback");
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");

    // Removal waits for the response.
    expect(storedQueue()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(storedQueue()).toHaveLength(0);
  });

  it("uses fetch keepalive on the unload path too, and still waits for ok", async () => {
    const fetchMock = vi.fn(() => res(true));
    vi.stubGlobal("fetch", fetchMock);

    feedback.record({ kind: "click", url: "https://example.com/a" });
    feedback.flush({ unload: true });

    expect(initOf(fetchMock).keepalive).toBe(true);
    expect(storedQueue()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(storedQueue()).toHaveLength(0);
  });

  it("keeps the events when the response is not ok", async () => {
    const fetchMock = vi.fn(() => res(false));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    feedback.record({ kind: "click", url: "https://example.com/a" });
    feedback.flush();
    await vi.advanceTimersByTimeAsync(0);

    expect(storedQueue()).toHaveLength(1);
  });

  it("does nothing and does not throw with an empty queue", () => {
    const fetchMock = vi.fn(() => res(true));
    vi.stubGlobal("fetch", fetchMock);
    expect(() => feedback.flush()).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still records and sends from memory when storage throws", async () => {
    const fetchMock = vi.fn(() => res(true));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    expect(() => feedback.record({ kind: "open", url: "https://example.com/a" })).not.toThrow();
    expect(() => feedback.flush()).not.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const events = eventsIn(initOf(fetchMock).body as string);
    expect(events).toHaveLength(1);
    expect(events[0].url).toBe("https://example.com/a");
  });

  it("logs and clears the batch in dev with no endpoint override", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_FEEDBACK_ENDPOINT", undefined);
    const fetchMock = vi.fn(() => res(true));
    vi.stubGlobal("fetch", fetchMock);
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    feedback.record({ kind: "open", url: "https://example.com/a" });
    feedback.flush();

    expect(debug).toHaveBeenCalledWith("[feedback]", expect.any(Array));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storedQueue()).toHaveLength(0);
  });
});

describe("flush: in-flight guard", () => {
  it("does not start a second request while one is still open", async () => {
    let settle: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      settle = resolve;
    });
    const fetchMock = vi.fn(() => pending);
    vi.stubGlobal("fetch", fetchMock);

    feedback.record({ kind: "click", url: "https://example.com/a" });
    feedback.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    feedback.record({ kind: "click", url: "https://example.com/b" });
    feedback.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    settle({ ok: true, status: 204 } as Response);
    await vi.advanceTimersByTimeAsync(0);

    // The event recorded mid-flight survived and goes out on the next flush.
    expect(storedQueue()).toHaveLength(1);
    feedback.flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("comes back on its own for events recorded while a request was open", async () => {
    let settle: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      settle = resolve;
    });
    const fetchMock = vi.fn(() => pending);
    vi.stubGlobal("fetch", fetchMock);

    feedback.record({ kind: "click", url: "https://example.com/a" });
    feedback.flush();
    feedback.record({ kind: "click", url: "https://example.com/b" });

    // The guarded flush must not throw the intent away: it re-arms.
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    settle({ ok: true, status: 204 } as Response);
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(eventsIn(initOf(fetchMock, 1).body as string)).toHaveLength(1);
  });
});

describe("flush: failure backoff", () => {
  it("retries three times with 4s / 8s / 16s backoff, then gives up", async () => {
    const fetchMock = vi.fn(() => res(false, 403));
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    feedback.record({ kind: "click", url: "https://example.com/a" });

    await vi.advanceTimersByTimeAsync(4000); // idle flush → failure 1
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4000); // retry 1 → failure 2
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(8000); // retry 2 → failure 3
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(16000); // retry 3 → failure 4, no more
    expect(fetchMock).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(120000);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // One warning for the whole streak, carrying the status.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[feedback] send failed", 403);
    expect(storedQueue()).toHaveLength(1);
  });

  it("waits the backoff, not the plain idle gap, before retry 2", async () => {
    const fetchMock = vi.fn(() => res(false));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    feedback.record({ kind: "click", url: "https://example.com/a" });
    await vi.advanceTimersByTimeAsync(4000); // failure 1 → arm 4s
    await vi.advanceTimersByTimeAsync(4000); // failure 2 → arm 8s
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000); // too early
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000); // 8s reached
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("resets the streak after a success, so warnings and retries start fresh", async () => {
    const results = [false, true, false];
    const fetchMock = vi.fn(() => res(results.shift() ?? true));
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    feedback.record({ kind: "click", url: "https://example.com/a" });
    await vi.advanceTimersByTimeAsync(4000); // failure 1
    expect(warn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4000); // retry succeeds
    expect(storedQueue()).toHaveLength(0);

    feedback.record({ kind: "click", url: "https://example.com/b" });
    await vi.advanceTimersByTimeAsync(4000); // failure, but a new streak
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("drops a 400 batch instead of retrying it, and does not re-arm", async () => {
    const fetchMock = vi.fn(() => res(false, 400));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    feedback.record({ kind: "click", url: "https://example.com/a" });
    feedback.flush();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storedQueue()).toHaveLength(0);

    // No backoff was armed behind the dropped batch.
    await vi.advanceTimersByTimeAsync(120000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps and retries a 500 batch, unlike a 400", async () => {
    const fetchMock = vi.fn(() => res(false, 500));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    feedback.record({ kind: "click", url: "https://example.com/a" });
    feedback.flush();
    await vi.advanceTimersByTimeAsync(0);

    expect(storedQueue()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(4000); // backoff retry 1
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(storedQueue()).toHaveLength(1);
  });

  it("does not schedule a retry while the page is unloading", async () => {
    const fetchMock = vi.fn(() => res(false));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    feedback.record({ kind: "click", url: "https://example.com/a" });
    feedback.flush({ unload: true });
    await vi.advanceTimersByTimeAsync(60000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storedQueue()).toHaveLength(1);
  });
});

describe("idle timer", () => {
  it("flushes 4 seconds after the last record", async () => {
    const fetchMock = vi.fn(() => res(true));
    vi.stubGlobal("fetch", fetchMock);

    feedback.record({ kind: "click", url: "https://example.com/a" });
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).not.toHaveBeenCalled();

    // A second record re-arms the timer.
    feedback.record({ kind: "click", url: "https://example.com/b" });
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(eventsIn(initOf(fetchMock).body as string)).toHaveLength(2);
  });
});

describe("install", () => {
  it("flushes when the tab is hidden, and stops after cleanup", async () => {
    const fetchMock = vi.fn(() => res(true));
    vi.stubGlobal("fetch", fetchMock);
    const cleanup = feedback.install();

    feedback.record({ kind: "click", url: "https://example.com/a" });
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(initOf(fetchMock).keepalive).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(storedQueue()).toHaveLength(0);

    cleanup();
    feedback.record({ kind: "click", url: "https://example.com/b" });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("flushes on pagehide", () => {
    const fetchMock = vi.fn(() => res(true));
    vi.stubGlobal("fetch", fetchMock);
    const cleanup = feedback.install();

    feedback.record({ kind: "click", url: "https://example.com/a" });
    window.dispatchEvent(new Event("pagehide"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
