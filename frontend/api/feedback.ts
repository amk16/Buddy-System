// Vercel Function: the reader-feedback collector.
//
// It takes a small batch of events from the dashboard, validates every one of
// them, and appends the survivors to feedback/YYYY-MM.jsonl on a branch that is
// never deployed. Same-origin only: no CORS headers are ever sent, so a browser
// on another site cannot read a reply even if it manages to send a request.
//
// Environment variables (set in the Vercel project):
//   GITHUB_TOKEN              fine-grained PAT with contents:write on the repo.
//                             Never logged, never returned.
//   GITHUB_REPO               "owner/name"; defaults to amk16/Buddy-System.
//   FEEDBACK_BRANCH           branch the lines land on; defaults to "feedback".
//   FEEDBACK_ALLOWED_ORIGINS  comma-separated exact origins, e.g.
//                             "https://pulse.example.com". localhost is added
//                             automatically outside production.

import { appendLines } from "./_lib/github";
import type { GhCfg } from "./_lib/github";
import { MAX_BODY } from "./_lib/schema";
import type { FeedbackEvent } from "./_lib/schema";
import { fileFor, originAllowed, parseBody, validateBatch } from "./_lib/validate";

const DEV_ORIGINS = ["http://localhost:5173", "http://localhost:3000"];

function allowedOrigins(): string[] {
  const configured = (process.env.FEEDBACK_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  // Preview and development deployments also answer the local dev server.
  return process.env.VERCEL_ENV === "production"
    ? configured
    : [...configured, ...DEV_ORIGINS];
}

function empty(status: number): Response {
  return new Response(null, { status });
}

function problem(status: number, message: string, extra?: Record<string, string>): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", ...extra },
  });
}

// The whole request contract lives here as a plain function so the tests can
// call it directly, without going through the runtime's entry point.
export async function handle(request: Request): Promise<Response> {
  try {
    // A same-origin preflight needs no headers back; anything cross-origin is
    // refused a step later anyway.
    if (request.method === "OPTIONS") return empty(204);
    if (request.method !== "POST") {
      return problem(405, "method not allowed", { Allow: "POST" });
    }

    if (!originAllowed(request.headers.get("origin"), allowedOrigins())) {
      return problem(403, "forbidden");
    }

    const token = process.env.GITHUB_TOKEN ?? "";
    const repo = process.env.GITHUB_REPO ?? "amk16/Buddy-System";
    if (!token || !repo) {
      // Deliberately vague: the value itself must never reach a log.
      console.error("[feedback] missing GITHUB_TOKEN or GITHUB_REPO");
      return problem(500, "feedback unavailable");
    }

    // Two size checks: the advertised length, then what actually arrived. Both
    // are in bytes — a character count would let multi-byte text through at
    // three or four times the cap.
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_BODY) return problem(413, "too large");
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BODY) return problem(413, "too large");

    const { events } = validateBatch(parseBody(text));
    if (events.length === 0) return problem(400, "no valid events");

    // One file per month, so a batch that straddles a month boundary writes
    // twice. Sequential on purpose: two parallel writes to the same branch
    // would just fight over the head commit.
    const byFile = new Map<string, FeedbackEvent[]>();
    for (const event of events) {
      const path = fileFor(event.ts);
      const bucket = byFile.get(path);
      if (bucket) bucket.push(event);
      else byFile.set(path, [event]);
    }

    const cfg: GhCfg = {
      token,
      repo,
      branch: process.env.FEEDBACK_BRANCH ?? "feedback",
    };
    for (const [path, batch] of byFile) {
      await appendLines(cfg, path, batch);
    }

    return empty(204);
  } catch (err) {
    // Log the shape of the failure, never the request or the credentials.
    console.error("[feedback] failed:", err instanceof Error ? err.message : "unknown error");
    return problem(500, "feedback failed");
  }
}

// Vercel's Functions API for a non-Next project takes the Web Standard `fetch`
// export: the runtime hands it a Request and expects a Response.
export default {
  async fetch(request: Request): Promise<Response> {
    return handle(request);
  },
};
