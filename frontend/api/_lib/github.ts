// The GitHub Contents API, spoken with plain fetch — no SDK, so the deployed
// function stays tiny. Feedback lines are committed to their own branch, never
// to main.
//
// Never let the token out: errors here carry the HTTP status and nothing else,
// because a GitHub error body can quote the request that contained it.

import { mergeLines } from "./validate.js";
import type { FeedbackEvent } from "./schema.js";

export interface GhCfg {
  token: string;
  repo: string;
  branch: string;
}

const API = "https://api.github.com";
const COMMITTER = {
  name: "pulse-bot",
  email: "pulse-bot@users.noreply.github.com",
};

function headers(cfg: GhCfg): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "buddy-system-feedback",
  };
}

// Status only — see the note at the top of the file.
function fail(status: number): Error {
  return new Error(`github ${status}`);
}

// The Contents API stops returning file bodies past 1 MB; warn well before
// then, because the month file is append-only and only ever grows.
const WARN_CHARS = 800_000;

export async function getFile(
  cfg: GhCfg,
  path: string,
): Promise<{ sha: string; text: string } | null> {
  const url = `${API}/repos/${cfg.repo}/contents/${path}?ref=${encodeURIComponent(cfg.branch)}`;
  const res = await fetch(url, { headers: headers(cfg) });
  if (res.status === 404) return null;
  if (!res.ok) throw fail(res.status);

  const body = (await res.json()) as {
    sha?: string;
    content?: string;
    encoding?: string;
  };

  // Over 1 MB GitHub answers 200 with content:"" and encoding:"none". Reading
  // that as an empty file would make the next append overwrite the month, so
  // anything that is not base64 is a hard error.
  if (body.encoding !== "base64") throw new Error("github oversized");
  // No sha means this was not the file we asked for (a directory listing, say),
  // and writing without one would try to create a file that already exists.
  if (typeof body.sha !== "string" || body.sha.length === 0) throw fail(res.status);

  const text = body.content ? Buffer.from(body.content, "base64").toString("utf8") : "";
  if (text.length > WARN_CHARS) {
    console.warn(`[feedback] ${path} is ${text.length} chars — near the Contents API limit`);
  }
  return { sha: body.sha, text };
}

// "conflict" means the file moved under us (someone else appended first) — the
// caller re-reads and tries again.
// True when GitHub's complaint is about the file's sha, which means someone
// else committed first and a re-read will fix it.
async function mentionsSha(res: Response): Promise<boolean> {
  try {
    const body = (await res.json()) as { message?: unknown };
    return typeof body.message === "string" && /sha/i.test(body.message);
  } catch {
    return false;
  }
}

export async function putFile(
  cfg: GhCfg,
  path: string,
  text: string,
  sha: string | undefined,
  message: string,
): Promise<"ok" | "conflict"> {
  const url = `${API}/repos/${cfg.repo}/contents/${path}`;
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(text, "utf8").toString("base64"),
    branch: cfg.branch,
    committer: COMMITTER,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers(cfg), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 200 || res.status === 201) return "ok";
  if (res.status === 409) return "conflict";
  // A 422 covers everything from "your sha is stale" (retry) to "branch
  // protection says no" (hopeless), so the message decides. It is read for that
  // one test and never travels any further.
  if (res.status === 422 && (await mentionsSha(res))) return "conflict";
  throw fail(res.status);
}

// The feedback branch is created lazily, off main, the first time anything is
// written.
export async function ensureBranch(cfg: GhCfg): Promise<void> {
  const refUrl = `${API}/repos/${cfg.repo}/git/ref/heads/${cfg.branch}`;
  const existing = await fetch(refUrl, { headers: headers(cfg) });
  if (existing.ok) return;
  if (existing.status !== 404) throw fail(existing.status);

  const mainRes = await fetch(`${API}/repos/${cfg.repo}/git/ref/heads/main`, {
    headers: headers(cfg),
  });
  if (!mainRes.ok) throw fail(mainRes.status);
  const main = (await mainRes.json()) as { object?: { sha?: string } };
  const sha = main.object?.sha;
  if (!sha) throw fail(mainRes.status);

  const created = await fetch(`${API}/repos/${cfg.repo}/git/refs`, {
    method: "POST",
    headers: { ...headers(cfg), "content-type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${cfg.branch}`, sha }),
  });
  if (!created.ok) throw fail(created.status);
}

// The three calls appendLines makes, swappable so the retry logic can be
// tested without touching the network.
export interface GhIo {
  getFile: typeof getFile;
  putFile: typeof putFile;
  ensureBranch: typeof ensureBranch;
}

const ATTEMPTS = 3;

// A month file that grows past what the Contents API will return cannot be
// appended to any more, so the writes roll over to a numbered continuation:
// feedback/2026-09.jsonl, then -2, then -3. The backend reads every
// feedback/*.jsonl, so a rolled month is still read back as one history.
const MAX_FILES = 9;
const SUFFIX = ".jsonl";

// The nth file for a month: 1 is the month itself, 2 and up are continuations.
function rolledPath(path: string, n: number): string {
  if (n <= 1) return path;
  const stem = path.endsWith(SUFFIX) ? path.slice(0, -SUFFIX.length) : path;
  return `${stem}-${n}${SUFFIX}`;
}

// The one failure a rollover answers. Anything else is a real error and travels.
function isOversized(err: unknown): boolean {
  return err instanceof Error && err.message === "github oversized";
}

// Read-merge-write, retried on conflict, rolling over to a continuation file
// when the month has grown too big to read. Returns how many events were
// actually new; events already in the file are skipped, so a client retry is
// free.
export async function appendLines(
  cfg: GhCfg,
  path: string,
  events: FeedbackEvent[],
  io: GhIo = { getFile, putFile, ensureBranch },
): Promise<number> {
  // Shared across rollovers: the branch only ever needs creating once.
  const state = { ensured: false };
  let oversized: unknown;

  for (let n = 1; n <= MAX_FILES; n++) {
    try {
      return await appendToFile(cfg, rolledPath(path, n), events, io, state);
    } catch (err) {
      if (!isOversized(err)) throw err;
      oversized = err;
    }
  }

  throw oversized;
}

async function appendToFile(
  cfg: GhCfg,
  path: string,
  events: FeedbackEvent[],
  io: GhIo,
  state: { ensured: boolean },
): Promise<number> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    let file = await io.getFile(cfg, path);

    // Missing file: it may just be a missing branch. Create it once, look
    // again, and if it is still absent treat it as an empty file.
    if (!file && !state.ensured) {
      state.ensured = true;
      await io.ensureBranch(cfg);
      file = await io.getFile(cfg, path);
    }

    const { text, added } = mergeLines(file?.text ?? "", events);
    if (added === 0) return 0;

    const message = `feedback: ${added} event${added === 1 ? "" : "s"}`;
    const result = await io.putFile(cfg, path, text, file?.sha, message);
    if (result === "ok") return added;
  }

  throw new Error(`github conflict after ${ATTEMPTS} attempts`);
}
