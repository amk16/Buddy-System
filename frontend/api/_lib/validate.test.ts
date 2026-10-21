import { describe, expect, it } from "vitest";
import { MAX_EVENTS, REASONS } from "./schema";
import type { FeedbackEvent } from "./schema";
import {
  fileFor,
  mergeLines,
  originAllowed,
  parseBody,
  validateBatch,
  validateEvent,
} from "./validate";

// A well-formed event; each case bends one field out of shape.
function good(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    id: "e1",
    ts: "2026-09-22T10:00:00.000Z",
    client_id: "c1",
    issue_id: "2026-09-20",
    engine: "gemini",
    url: "https://example.com/a",
    kind: "more",
    ...over,
  };
}

describe("parseBody", () => {
  it("parses JSON and returns null on anything else", () => {
    expect(parseBody('{"v":1}')).toEqual({ v: 1 });
    expect(parseBody("not json")).toBeNull();
    expect(parseBody("")).toBeNull();
  });
});

describe("validateEvent", () => {
  it("accepts a well-formed event", () => {
    expect(validateEvent(good())).not.toBeNull();
  });

  it("rejects non-objects", () => {
    expect(validateEvent(null)).toBeNull();
    expect(validateEvent("x")).toBeNull();
    expect(validateEvent([])).toBeNull();
  });

  it("rejects a wrong or missing version", () => {
    expect(validateEvent(good({ v: 2 }))).toBeNull();
    expect(validateEvent(good({ v: "1" }))).toBeNull();
  });

  it("rejects a bad id", () => {
    expect(validateEvent(good({ id: "" }))).toBeNull();
    expect(validateEvent(good({ id: "x".repeat(65) }))).toBeNull();
    expect(validateEvent(good({ id: 5 }))).toBeNull();
  });

  it("rejects a bad timestamp", () => {
    expect(validateEvent(good({ ts: "yesterday" }))).toBeNull();
    expect(validateEvent(good({ ts: "2026-09-22" }))).toBeNull();
    expect(validateEvent(good({ ts: "2026-13-99T10:00:00Z" }))).toBeNull();
  });

  it("rejects a bad client_id", () => {
    expect(validateEvent(good({ client_id: "" }))).toBeNull();
    expect(validateEvent(good({ client_id: "c".repeat(65) }))).toBeNull();
  });

  it("rejects a bad issue_id and accepts the suffixed form", () => {
    expect(validateEvent(good({ issue_id: "2026-9-20" }))).toBeNull();
    expect(validateEvent(good({ issue_id: "nope" }))).toBeNull();
    expect(validateEvent(good({ issue_id: "2026-09-20-2" }))).not.toBeNull();
  });

  it("rejects an unknown engine", () => {
    expect(validateEvent(good({ engine: "openai" }))).toBeNull();
  });

  it("rejects an unknown kind", () => {
    expect(validateEvent(good({ kind: "love" }))).toBeNull();
  });

  it("rejects a url that is not http(s), empty or too long", () => {
    expect(validateEvent(good({ url: "javascript:alert(1)" }))).toBeNull();
    expect(validateEvent(good({ url: "" }))).toBeNull();
    expect(validateEvent(good({ url: `https://e.com/${"a".repeat(2048)}` }))).toBeNull();
  });

  it("allows an empty url only on the issue check-in", () => {
    const ev = validateEvent(good({ kind: "issue", value: "useful", url: "" }));
    expect(ev?.url).toBe("");
  });

  it("keeps only known reasons, deduped and capped at 10", () => {
    const ev = validateEvent(
      good({ reasons: ["too_technical", "too_technical", "made_up", "source"] }),
    );
    expect(ev?.reasons).toEqual(["too_technical", "source"]);

    const many = validateEvent(good({ reasons: [...REASONS, ...REASONS] }));
    expect(many?.reasons).toHaveLength(10);
  });

  it("drops reasons on the implicit kinds and when nothing known survives", () => {
    expect(validateEvent(good({ kind: "open", reasons: ["source"] }))?.reasons).toBeUndefined();
    expect(validateEvent(good({ kind: "issue", value: "fine", url: "", reasons: ["source"] }))?.reasons).toBeUndefined();
    expect(validateEvent(good({ reasons: ["made_up"] }))?.reasons).toBeUndefined();
    expect(validateEvent(good({ reasons: "source" }))?.reasons).toBeUndefined();
  });

  it("rejects a value on any kind but issue, and an unknown value", () => {
    expect(validateEvent(good({ value: "useful" }))).toBeNull();
    expect(validateEvent(good({ kind: "issue", url: "", value: "great" }))).toBeNull();
    expect(validateEvent(good({ kind: "issue", url: "", value: "noise" }))).not.toBeNull();
  });

  it("rejects an over-long or non-string section", () => {
    expect(validateEvent(good({ section: "s".repeat(33) }))).toBeNull();
    expect(validateEvent(good({ section: 7 }))).toBeNull();
    expect(validateEvent(good({ section: "tools" }))?.section).toBe("tools");
  });

  it("strips unknown keys", () => {
    const ev = validateEvent(good({ note: "hi", client_ip: "1.2.3.4" }));
    expect(ev).not.toBeNull();
    expect(Object.keys(ev as object).sort()).toEqual(
      ["client_id", "engine", "id", "issue_id", "kind", "ts", "url", "v"],
    );
  });
});

describe("validateBatch", () => {
  it("rejects a body that is not {v:1, events:[...]}", () => {
    expect(validateBatch(null)).toEqual({ events: [], rejected: 0 });
    expect(validateBatch({ v: 2, events: [] })).toEqual({ events: [], rejected: 0 });
    expect(validateBatch({ v: 1, events: "no" })).toEqual({ events: [], rejected: 0 });
  });

  it("keeps the good events and counts the bad ones", () => {
    const out = validateBatch({ v: 1, events: [good(), good({ v: 9 }), "x"] });
    expect(out.events).toHaveLength(1);
    expect(out.rejected).toBe(2);
  });

  it("caps the batch and counts the overflow as rejected", () => {
    const events = Array.from({ length: MAX_EVENTS + 5 }, (_, i) => good({ id: `e${i}` }));
    const out = validateBatch({ v: 1, events });
    expect(out.events).toHaveLength(MAX_EVENTS);
    expect(out.rejected).toBe(5);
  });
});

describe("originAllowed", () => {
  const allowed = ["https://pulse.example.com", "http://localhost:5173"];

  it("matches only exactly", () => {
    expect(originAllowed("https://pulse.example.com", allowed)).toBe(true);
    expect(originAllowed("https://pulse.example.com.evil.net", allowed)).toBe(false);
    expect(originAllowed("https://pulse.example.com/", allowed)).toBe(false);
    expect(originAllowed("https://evil.net", allowed)).toBe(false);
  });

  it("rejects a missing origin", () => {
    expect(originAllowed(null, allowed)).toBe(false);
    expect(originAllowed("", allowed)).toBe(false);
  });
});

describe("fileFor", () => {
  it("buckets by the UTC month", () => {
    expect(fileFor("2026-09-22T10:00:00.000Z")).toBe("feedback/2026-09.jsonl");
    // Just before UTC midnight on the 1st of October, local time is irrelevant.
    expect(fileFor("2026-09-30T23:59:59.999Z")).toBe("feedback/2026-09.jsonl");
    expect(fileFor("2026-10-01T00:00:00.000Z")).toBe("feedback/2026-10.jsonl");
    expect(fileFor("2026-01-01T00:00:00.000Z")).toBe("feedback/2026-01.jsonl");
  });
});

describe("mergeLines", () => {
  const ev = (id: string) => validateEvent(good({ id })) as FeedbackEvent;

  it("appends new events in order and ends with a newline", () => {
    const out = mergeLines("", [ev("a"), ev("b")]);
    expect(out.added).toBe(2);
    const ids = out.text.trim().split("\n").map((l) => (JSON.parse(l) as FeedbackEvent).id);
    expect(ids).toEqual(["a", "b"]);
    expect(out.text.endsWith("\n")).toBe(true);
  });

  it("skips ids already in the file and dedupes within the batch", () => {
    const first = mergeLines("", [ev("a")]);
    const out = mergeLines(first.text, [ev("a"), ev("b"), ev("b")]);
    expect(out.added).toBe(1);
    const ids = out.text.trim().split("\n").map((l) => (JSON.parse(l) as FeedbackEvent).id);
    expect(ids).toEqual(["a", "b"]);
  });

  it("leaves malformed existing lines untouched and still appends", () => {
    const existing = "{not json}\n";
    const out = mergeLines(existing, [ev("a")]);
    expect(out.text.startsWith("{not json}\n")).toBe(true);
    expect(out.added).toBe(1);
  });

  it("adds the missing newline to an existing file that lacks one", () => {
    const existing = `${JSON.stringify(ev("a"))}`;
    const out = mergeLines(existing, [ev("b")]);
    expect(out.text.split("\n").filter(Boolean)).toHaveLength(2);
    expect(out.text.endsWith("\n")).toBe(true);
  });
});
