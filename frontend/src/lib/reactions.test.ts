import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedbackEvent } from "./types";
import * as feedback from "./feedback";
import * as reactions from "./reactions";

// The store that remembers what Kajol marked, and turns each tap into the
// undo-then-resend pair the backend resolver expects.

const QUEUE_KEY = "pulse.feedback.v1";
const STORE_KEY = "pulse.reactions.v1";
const URL_A = "https://example.com/a";
const URL_B = "https://example.com/b";

function queue(): FeedbackEvent[] {
  const raw = localStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as FeedbackEvent[]) : [];
}

// An eight-line mirror of backend/reader_profile.py resolve_reactions, minus
// the implicit-kind dedup this store never produces: oldest first, an undo pops
// the most recent kept explicit event for the same card, then disappears.
const EXPLICIT = ["more", "loved", "less"];
function resolve(events: FeedbackEvent[]): FeedbackEvent[] {
  const kept: FeedbackEvent[] = [];
  for (const e of [...events].sort((a, b) => a.ts.localeCompare(b.ts))) {
    if (e.kind === "undo") {
      for (let i = kept.length - 1; i >= 0; i -= 1) {
        if (EXPLICIT.includes(kept[i].kind) && kept[i].url === e.url) {
          kept.splice(i, 1);
          break;
        }
      }
      continue;
    }
    kept.push(e);
  }
  return kept;
}

// What the backend would be left holding for one card.
function settled(url: string): FeedbackEvent[] {
  return resolve(queue()).filter((e) => e.url === url);
}

beforeEach(() => {
  localStorage.clear();
  feedback._resetForTests();
  reactions._resetForTests();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-22T10:00:00.000Z"));
  feedback.setContext({ issue_id: "2026-09-22", engine: "claude" });
  reactions.setIssue("2026-09-22");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("reactions store", () => {
  it("climbs like then super like, leaving exactly one explicit event each time", () => {
    reactions.setLevel(URL_A, "tools", "more");
    expect(reactions.getEntry(URL_A).level).toBe("more");
    expect(settled(URL_A).map((e) => e.kind)).toEqual(["more"]);

    reactions.setLevel(URL_A, "tools", "loved");
    expect(reactions.getEntry(URL_A).level).toBe("loved");
    expect(settled(URL_A).map((e) => e.kind)).toEqual(["loved"]);
  });

  it("clears to none, leaving the backend holding nothing for the card", () => {
    reactions.setLevel(URL_A, "tools", "more");
    reactions.setLevel(URL_A, "tools", "none");

    expect(reactions.getEntry(URL_A).level).toBe("none");
    expect(settled(URL_A)).toHaveLength(0);
    // The clear is an undo and nothing else.
    expect(queue().filter((e) => e.url === URL_A).at(-1)?.kind).toBe("undo");
  });

  it("precedes every explicit send with an undo, so a lost mirror cannot double-count", () => {
    reactions.setLevel(URL_A, "tools", "more");
    const kinds = queue()
      .filter((e) => e.url === URL_A)
      .map((e) => e.kind);
    expect(kinds).toEqual(["undo", "more"]);
  });

  it("stamps url, section and issue_id on every event it emits", () => {
    reactions.setLevel(URL_A, "news", "loved");
    for (const event of queue()) {
      expect(event.url).toBe(URL_A);
      expect(event.section).toBe("news");
      expect(event.issue_id).toBe("2026-09-22");
    }
  });

  it("carries reasons on the resent event, and drops them when a chip is toggled off", () => {
    reactions.setLevel(URL_A, "tools", "more");
    reactions.toggleReason(URL_A, "tools", "good_numbers");
    expect(reactions.getEntry(URL_A).reasons).toEqual(["good_numbers"]);
    expect(settled(URL_A)[0].reasons).toEqual(["good_numbers"]);

    reactions.toggleReason(URL_A, "tools", "good_numbers");
    expect(reactions.getEntry(URL_A).reasons).toEqual([]);
    const left = settled(URL_A);
    expect(left).toHaveLength(1);
    expect(left[0].kind).toBe("more");
    expect(left[0].reasons).toBeUndefined();
  });

  it("clears the reasons when the level changes under them", () => {
    reactions.setLevel(URL_A, "tools", "more");
    reactions.toggleReason(URL_A, "tools", "client_ready");

    reactions.setLevel(URL_A, "tools", "loved");
    expect(reactions.getEntry(URL_A).reasons).toEqual([]);
    const left = settled(URL_A);
    expect(left).toHaveLength(1);
    expect(left[0].kind).toBe("loved");
    expect(left[0].reasons).toBeUndefined();
  });

  it("forgets a stored dislike, which no longer exists on the card", () => {
    // v1 and v2 could write "less". The backend still accepts the kind, but
    // nothing sends it any more, so a leftover entry is dropped rather than
    // restored onto a control that cannot show it.
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        "2026-09-22": {
          touched: "2026-09-22T10:00:00.000Z",
          urls: {
            [URL_A]: { level: "less", reasons: ["off_topic"] },
            [URL_B]: { level: "more", reasons: [] },
          },
        },
      }),
    );
    reactions._resetForTests();
    reactions.setIssue("2026-09-22");

    expect(reactions.getEntry(URL_A).level).toBe("none");
    expect(reactions.getEntry(URL_B).level).toBe("more");
  });

  it("offers the positive chips at both raised levels, and none at rest", () => {
    expect(reactions.reasonsFor("more")).toEqual(reactions.REASONS_POSITIVE);
    expect(reactions.reasonsFor("loved")).toEqual(reactions.REASONS_POSITIVE);
    expect(reactions.reasonsFor("none")).toEqual([]);
  });

  it("keeps five issues and evicts the least recently touched, never the lowest id", () => {
    // Six issues, touched in an order chosen so the two orderings disagree:
    // "2026-09-22" is the lowest id but the newest touch, so an id-ordered
    // eviction would throw away exactly the one that must survive.
    const ids = [
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-22-2",
      "2026-09-22",
    ];
    ids.forEach((id, i) => {
      vi.setSystemTime(new Date(`2026-09-22T1${i}:00:00.000Z`));
      reactions.setIssue(id);
      reactions.setLevel(URL_A, "tools", "more");
    });

    const stored = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
    const kept = Object.keys(stored).sort();
    expect(kept).toHaveLength(5);
    expect(kept).toContain("2026-09-22"); // lowest id, newest touch
    expect(kept).toContain("2026-09-22-2");
    expect(kept).not.toContain("2026-09-23"); // oldest touch, highest id but one
  });

  it("does not let an emptied issue keep one of the five slots", () => {
    reactions.setIssue("2026-09-01");
    reactions.setLevel(URL_A, "tools", "more");
    reactions.setLevel(URL_A, "tools", "none"); // the bucket is now empty

    const stored = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
    expect(Object.keys(stored)).not.toContain("2026-09-01");
  });

  it("notifies subscribers when the issue changes, and stays quiet when it repeats", () => {
    let calls = 0;
    const stop = reactions.subscribe(() => {
      calls += 1;
    });

    reactions.setIssue("2026-09-23");
    expect(calls).toBe(1);
    reactions.setIssue("2026-09-23");
    expect(calls).toBe(1);
    stop();
  });

  it("forgets reason ids it does not recognise when reading storage", () => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        "2026-09-22": {
          touched: "2026-09-22T10:00:00.000Z",
          urls: { [URL_A]: { level: "more", reasons: ["good_numbers", "made_up"] } },
        },
      }),
    );
    reactions._resetForTests();
    reactions.setIssue("2026-09-22");

    expect(reactions.getEntry(URL_A).reasons).toEqual(["good_numbers"]);
  });

  it("restores a stored level on the first read after a reload", () => {
    reactions.setLevel(URL_A, "tools", "loved");

    reactions._resetForTests();
    reactions.setIssue("2026-09-22");
    expect(reactions.getEntry(URL_A).level).toBe("loved");
    expect(reactions.getEntry(URL_B).level).toBe("none");
  });

  it("still changes the level when localStorage refuses to write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => reactions.setLevel(URL_A, "tools", "more")).not.toThrow();
    expect(reactions.getEntry(URL_A).level).toBe("more");
  });

  it("notifies subscribers and hands back a snapshot stable between changes", () => {
    let calls = 0;
    const stop = reactions.subscribe(() => {
      calls += 1;
    });

    const before = reactions.getEntry(URL_A);
    expect(reactions.getEntry(URL_A)).toBe(before); // same reference, no change

    reactions.setLevel(URL_A, "tools", "more");
    expect(calls).toBe(1);
    const after = reactions.getEntry(URL_A);
    expect(after).not.toBe(before);
    expect(reactions.getEntry(URL_A)).toBe(after);
    // A different card is untouched by the write.
    expect(reactions.getEntry(URL_B)).toBe(reactions.getEntry(URL_B));

    stop();
    reactions.setLevel(URL_A, "tools", "loved");
    expect(calls).toBe(1);
  });

  it("still publishes all eleven reason ids, because the API contract holds them", () => {
    expect(reactions.REASONS_POSITIVE).toEqual([
      "client_ready",
      "learned_something",
      "good_numbers",
      "worth_following",
      "my_industry",
    ]);
    expect(reactions.REASONS_NEGATIVE).toEqual([
      "too_technical",
      "not_my_clients",
      "already_knew",
      "no_numbers",
      "off_topic",
      "source",
    ]);
    const all = [...reactions.REASONS_POSITIVE, ...reactions.REASONS_NEGATIVE];
    expect(all).toHaveLength(11);
    for (const id of all) expect(reactions.REASON_LABELS[id]).toBeTruthy();
    expect(reactions.REASON_LABELS.source).toBe("Not this source");
  });
});
