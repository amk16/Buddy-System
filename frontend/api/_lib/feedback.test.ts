import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedbackEvent } from "./schema";

// The GitHub half is stubbed: these cases are about the request contract.
const appendLines = vi.hoisted(() => vi.fn(() => Promise.resolve(1)));
vi.mock("./github", () => ({ appendLines }));

import handler, { handle } from "../feedback";

const ORIGIN = "https://pulse.example.com";

function event(over: Partial<FeedbackEvent> = {}): FeedbackEvent {
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

function post(events: unknown[], origin: string | null = ORIGIN): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (origin) headers.origin = origin;
  return new Request("https://pulse.example.com/api/feedback", {
    method: "POST",
    headers,
    body: JSON.stringify({ v: 1, events }),
  });
}

beforeEach(() => {
  appendLines.mockClear();
  appendLines.mockImplementation(() => Promise.resolve(1));
  vi.stubEnv("GITHUB_TOKEN", "s3cret-token");
  vi.stubEnv("GITHUB_REPO", "amk16/Buddy-System");
  vi.stubEnv("FEEDBACK_ALLOWED_ORIGINS", ORIGIN);
  vi.stubEnv("VERCEL_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("handler", () => {
  it("answers OPTIONS with 204 and no CORS headers", async () => {
    const res = await handle(new Request("https://x/api/feedback", { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects anything but POST with 405 and says what is allowed", async () => {
    const res = await handle(new Request("https://x/api/feedback", { method: "GET" }));
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
  });

  it("is exported as a web-standard fetch handler", async () => {
    // Vercel calls `default.fetch(request)` for a non-Next project.
    expect(typeof handler.fetch).toBe("function");
    const res = await handler.fetch(new Request("https://x/api/feedback", { method: "GET" }));
    expect(res.status).toBe(405);
  });

  it("rejects an unlisted or missing origin with 403", async () => {
    expect((await handle(post([event()], "https://evil.net"))).status).toBe(403);
    expect((await handle(post([event()], null))).status).toBe(403);
    expect((await handle(post([event()], `${ORIGIN}.evil.net`))).status).toBe(403);
  });

  it("allows localhost only outside production", async () => {
    expect((await handle(post([event()], "http://localhost:5173"))).status).toBe(403);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await handle(post([event()], "http://localhost:5173"))).status).toBe(204);
    expect((await handle(post([event()], "http://localhost:3000"))).status).toBe(204);
  });

  it("rejects an oversized body with 413", async () => {
    const req = new Request("https://x/api/feedback", {
      method: "POST",
      headers: { origin: ORIGIN, "content-length": String(65 * 1024) },
      body: JSON.stringify({ v: 1, events: [event()] }),
    });
    expect((await handle(req)).status).toBe(413);
    expect(appendLines).not.toHaveBeenCalled();
  });

  it("measures the body cap in bytes, not characters", async () => {
    // 22_000 three-byte characters: well under the cap by length, well over it
    // by bytes. The declared length is honest about the character count.
    const filler = "\u306e".repeat(22_000);
    const body = JSON.stringify({ v: 1, events: [event()], filler });
    const req = new Request("https://x/api/feedback", {
      method: "POST",
      headers: { origin: ORIGIN, "content-length": "22000" },
      body,
    });

    expect(body.length).toBeLessThan(64 * 1024);
    expect(new TextEncoder().encode(body).length).toBeGreaterThan(64 * 1024);
    expect((await handle(req)).status).toBe(413);
    expect(appendLines).not.toHaveBeenCalled();
  });

  it("rejects a body with nothing valid in it with 400", async () => {
    expect((await handle(post([{ v: 9 }]))).status).toBe(400);
    expect((await handle(post([]))).status).toBe(400);
    expect(appendLines).not.toHaveBeenCalled();
  });

  it("stores accepted events grouped by month and answers 204", async () => {
    const res = await handle(
      post([
        event({ id: "a", ts: "2026-09-30T23:59:59.000Z" }),
        event({ id: "b", ts: "2026-10-01T00:00:01.000Z" }),
        event({ id: "c", ts: "2026-09-02T09:00:00.000Z" }),
      ]),
    );
    expect(res.status).toBe(204);
    expect(appendLines).toHaveBeenCalledTimes(2);

    const paths = appendLines.mock.calls.map((c) => (c as unknown as [unknown, string])[1]);
    expect(paths.sort()).toEqual(["feedback/2026-09.jsonl", "feedback/2026-10.jsonl"]);
  });

  it("returns 500 without the token when the token is missing", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await handle(post([event()]));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("s3cret");
    const logged = error.mock.calls.flat().join(" ");
    expect(logged).not.toContain("s3cret");
  });

  it("returns a generic 500 when the store throws", async () => {
    appendLines.mockImplementation(() => Promise.reject(new Error("github 403")));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await handle(post([event()]));
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("feedback failed");
    expect(error).toHaveBeenCalled();
  });
});
