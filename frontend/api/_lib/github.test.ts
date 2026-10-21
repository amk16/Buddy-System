import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedbackEvent } from "./schema";
import { appendLines, ensureBranch, getFile, putFile, type GhCfg } from "./github";

const cfg: GhCfg = { token: "s3cret-token", repo: "amk16/Buddy-System", branch: "feedback" };

const event: FeedbackEvent = {
  v: 1,
  id: "e1",
  ts: "2026-09-22T10:00:00.000Z",
  client_id: "c1",
  issue_id: "2026-09-20",
  engine: "gemini",
  url: "https://example.com/a",
  kind: "more",
};

function reply(status: number, body: unknown = {}) {
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getFile", () => {
  it("decodes the base64 content and sends the auth headers", async () => {
    const fetchMock = vi.fn(() =>
      reply(200, { sha: "abc", content: Buffer.from("line\n").toString("base64"), encoding: "base64" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const file = await getFile(cfg, "feedback/2026-09.jsonl");
    expect(file).toEqual({ sha: "abc", text: "line\n" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://api.github.com/repos/amk16/Buddy-System/contents/feedback/2026-09.jsonl?ref=feedback",
    );
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer s3cret-token");
    expect(headers.Accept).toBe("application/vnd.github+json");
    expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
    expect(headers["User-Agent"]).toBe("buddy-system-feedback");
  });

  it("refuses a payload GitHub did not base64-encode", async () => {
    // Files over 1 MB come back 200 with content:"" and encoding:"none".
    // Reading that as an empty file would make the next write wipe the month.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(200, { sha: "abc", content: "", encoding: "none" })),
    );
    await expect(getFile(cfg, "feedback/2026-09.jsonl")).rejects.toThrow("github oversized");
  });

  it("refuses a payload with no sha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(200, { content: Buffer.from("x\n").toString("base64"), encoding: "base64" })),
    );
    await expect(getFile(cfg, "p")).rejects.toThrow("github 200");
  });

  it("warns when the file is close to the size the API can still return", async () => {
    const big = "a".repeat(800_001);
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        reply(200, { sha: "abc", content: Buffer.from(big).toString("base64"), encoding: "base64" }),
      ),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const file = await getFile(cfg, "feedback/2026-09.jsonl");
    expect(file?.text).toHaveLength(800_001);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("feedback/2026-09.jsonl");
  });

  it("returns null on 404", async () => {
    vi.stubGlobal("fetch", vi.fn(() => reply(404)));
    expect(await getFile(cfg, "feedback/2026-09.jsonl")).toBeNull();
  });

  it("throws a status-only error on anything else", async () => {
    vi.stubGlobal("fetch", vi.fn(() => reply(500, { message: "s3cret-token leaked" })));
    await expect(getFile(cfg, "x")).rejects.toThrow("github 500");
  });
});

describe("putFile", () => {
  it("sends the encoded content with the sha and reports ok", async () => {
    const fetchMock = vi.fn(() => reply(200));
    vi.stubGlobal("fetch", fetchMock);

    const out = await putFile(cfg, "feedback/2026-09.jsonl", "line\n", "abc", "msg");
    expect(out).toBe("ok");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.message).toBe("msg");
    expect(Buffer.from(body.content as string, "base64").toString("utf8")).toBe("line\n");
    expect(body.branch).toBe("feedback");
    expect(body.sha).toBe("abc");
    expect(body.committer).toEqual({
      name: "pulse-bot",
      email: "pulse-bot@users.noreply.github.com",
    });
  });

  it("omits the sha for a brand-new file", async () => {
    const fetchMock = vi.fn(() => reply(201));
    vi.stubGlobal("fetch", fetchMock);

    expect(await putFile(cfg, "p", "text\n", undefined, "msg")).toBe("ok");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect("sha" in (JSON.parse(init.body as string) as object)).toBe(false);
  });

  it("reports a conflict on 409", async () => {
    vi.stubGlobal("fetch", vi.fn(() => reply(409)));
    expect(await putFile(cfg, "p", "t", "abc", "m")).toBe("conflict");
  });

  it("reports a conflict on a 422 that is about the sha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(422, { message: "sha does not match" })),
    );
    expect(await putFile(cfg, "p", "t", "abc", "m")).toBe("conflict");
  });

  it("throws on a 422 that is about anything else", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(422, { message: "branch protection rule violated" })),
    );
    await expect(putFile(cfg, "p", "t", "abc", "m")).rejects.toThrow(/^github 422$/);
  });

  it("throws without echoing the response body", async () => {
    vi.stubGlobal("fetch", vi.fn(() => reply(403, { message: "token s3cret-token" })));
    await expect(putFile(cfg, "p", "t", "abc", "m")).rejects.toThrow(/^github 403$/);
  });
});

describe("ensureBranch", () => {
  it("does nothing when the branch exists", async () => {
    const fetchMock = vi.fn(() => reply(200, { object: { sha: "deadbeef" } }));
    vi.stubGlobal("fetch", fetchMock);

    await ensureBranch(cfg);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("creates the branch off main when it is missing", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn((url: string) => {
      calls.push(url);
      if (url.endsWith("git/ref/heads/feedback")) return reply(404);
      if (url.endsWith("git/ref/heads/main")) return reply(200, { object: { sha: "mainsha" } });
      return reply(201);
    });
    vi.stubGlobal("fetch", fetchMock);

    await ensureBranch(cfg);
    expect(calls).toHaveLength(3);
    const [, init] = fetchMock.mock.calls[2] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      ref: "refs/heads/feedback",
      sha: "mainsha",
    });
  });
});

describe("appendLines", () => {
  it("merges into the existing file and returns how many were added", async () => {
    const putFileStub = vi.fn(() => Promise.resolve("ok" as const));
    const io = {
      getFile: vi.fn(() => Promise.resolve({ sha: "abc", text: "" })),
      putFile: putFileStub,
      ensureBranch: vi.fn(() => Promise.resolve()),
    };

    const added = await appendLines(cfg, "feedback/2026-09.jsonl", [event], io);
    expect(added).toBe(1);
    expect(putFileStub).toHaveBeenCalledTimes(1);
    const text = (putFileStub.mock.calls[0] as unknown as unknown[])[2] as string;
    expect((JSON.parse(text.trim()) as FeedbackEvent).id).toBe("e1");
  });

  it("re-reads and retries when the put conflicts", async () => {
    const results: ("conflict" | "ok")[] = ["conflict", "ok"];
    const io = {
      getFile: vi.fn(() => Promise.resolve({ sha: "abc", text: "" })),
      putFile: vi.fn(() => Promise.resolve(results.shift() ?? "ok")),
      ensureBranch: vi.fn(() => Promise.resolve()),
    };

    expect(await appendLines(cfg, "p", [event], io)).toBe(1);
    expect(io.getFile).toHaveBeenCalledTimes(2);
    expect(io.putFile).toHaveBeenCalledTimes(2);
  });

  it("gives up after three conflicts", async () => {
    const io = {
      getFile: vi.fn(() => Promise.resolve({ sha: "abc", text: "" })),
      putFile: vi.fn(() => Promise.resolve("conflict" as const)),
      ensureBranch: vi.fn(() => Promise.resolve()),
    };

    await expect(appendLines(cfg, "p", [event], io)).rejects.toThrow(/conflict/);
    expect(io.putFile).toHaveBeenCalledTimes(3);
  });

  it("creates the branch once, then treats a still-missing file as empty", async () => {
    const io = {
      getFile: vi.fn(() => Promise.resolve(null)),
      putFile: vi.fn(() => Promise.resolve("ok" as const)),
      ensureBranch: vi.fn(() => Promise.resolve()),
    };

    expect(await appendLines(cfg, "p", [event], io)).toBe(1);
    expect(io.ensureBranch).toHaveBeenCalledTimes(1);
    // No sha, because there is no file yet.
    expect((io.putFile.mock.calls[0] as unknown as unknown[])[3]).toBeUndefined();
  });

  it("writes nothing when every event is already in the file", async () => {
    const io = {
      getFile: vi.fn(() => Promise.resolve({ sha: "abc", text: `${JSON.stringify(event)}\n` })),
      putFile: vi.fn(() => Promise.resolve("ok" as const)),
      ensureBranch: vi.fn(() => Promise.resolve()),
    };

    expect(await appendLines(cfg, "p", [event], io)).toBe(0);
    expect(io.putFile).not.toHaveBeenCalled();
  });

  it("rolls an oversized month over to a numbered continuation", async () => {
    const io = {
      getFile: vi.fn((_cfg: GhCfg, path: string) =>
        path === "feedback/2026-09.jsonl"
          ? Promise.reject(new Error("github oversized"))
          : Promise.resolve({ sha: "abc", text: "" }),
      ),
      putFile: vi.fn(() => Promise.resolve("ok" as const)),
      ensureBranch: vi.fn(() => Promise.resolve()),
    };

    expect(await appendLines(cfg, "feedback/2026-09.jsonl", [event], io)).toBe(1);
    expect(io.putFile).toHaveBeenCalledTimes(1);
    expect((io.putFile.mock.calls[0] as unknown as unknown[])[1]).toBe(
      "feedback/2026-09-2.jsonl",
    );
  });

  it("keeps rolling while each continuation is oversized too", async () => {
    const full = new Set(["feedback/2026-09.jsonl", "feedback/2026-09-2.jsonl"]);
    const io = {
      getFile: vi.fn((_cfg: GhCfg, path: string) =>
        full.has(path)
          ? Promise.reject(new Error("github oversized"))
          : Promise.resolve({ sha: "abc", text: "" }),
      ),
      putFile: vi.fn(() => Promise.resolve("ok" as const)),
      ensureBranch: vi.fn(() => Promise.resolve()),
    };

    expect(await appendLines(cfg, "feedback/2026-09.jsonl", [event], io)).toBe(1);
    expect((io.putFile.mock.calls[0] as unknown as unknown[])[1]).toBe(
      "feedback/2026-09-3.jsonl",
    );
  });

  it("throws once the rollover ceiling is exhausted", async () => {
    const io = {
      getFile: vi.fn(() => Promise.reject(new Error("github oversized"))),
      putFile: vi.fn(() => Promise.resolve("ok" as const)),
      ensureBranch: vi.fn(() => Promise.resolve()),
    };

    await expect(appendLines(cfg, "feedback/2026-09.jsonl", [event], io)).rejects.toThrow(
      "github oversized",
    );
    // The month itself plus continuations -2 through -9.
    expect(io.getFile).toHaveBeenCalledTimes(9);
    expect(io.putFile).not.toHaveBeenCalled();
  });

  it("lets any other read failure through without rolling over", async () => {
    const io = {
      getFile: vi.fn(() => Promise.reject(new Error("github 500"))),
      putFile: vi.fn(() => Promise.resolve("ok" as const)),
      ensureBranch: vi.fn(() => Promise.resolve()),
    };

    await expect(appendLines(cfg, "feedback/2026-09.jsonl", [event], io)).rejects.toThrow(
      "github 500",
    );
    expect(io.getFile).toHaveBeenCalledTimes(1);
  });
});
