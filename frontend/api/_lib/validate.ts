// Pure validation and file-shaping helpers for the feedback collector. No I/O
// here, so every rule is unit-testable on its own.

import {
  ENGINES,
  KINDS,
  MAX_EVENTS,
  MAX_REASONS,
  REASON_KINDS,
  REASONS,
  VALUES,
} from "./schema.js";
import type { Engine, FeedbackEvent, FeedbackKind, FeedbackValue } from "./schema.js";

const ISSUE_ID = /^\d{4}-\d{2}-\d{2}(-\d+)?$/;
const ISO_DATE_HEAD = /^\d{4}-\d{2}-\d{2}T/;
const MAX_URL = 2048;
const MAX_SECTION = 32;
const MAX_ID = 64;

export function parseBody(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isShortString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

// Returns a clean event or null. Unknown keys never survive: the result is
// rebuilt field by field, so nothing a client invents reaches the store.
export function validateEvent(e: unknown): FeedbackEvent | null {
  if (typeof e !== "object" || e === null || Array.isArray(e)) return null;
  const raw = e as Record<string, unknown>;

  if (raw.v !== 1) return null;
  if (!isShortString(raw.id, MAX_ID)) return null;
  if (!isShortString(raw.client_id, MAX_ID)) return null;
  if (!isShortString(raw.ts, 64)) return null;
  // Both checks matter: Date.parse is lenient about formats, the regex pins the
  // shape, and together they rule out things like "2026-13-99T…".
  if (!ISO_DATE_HEAD.test(raw.ts) || Number.isNaN(Date.parse(raw.ts))) return null;
  if (typeof raw.issue_id !== "string" || !ISSUE_ID.test(raw.issue_id)) return null;
  if (typeof raw.engine !== "string" || !(ENGINES as readonly string[]).includes(raw.engine)) {
    return null;
  }
  if (typeof raw.kind !== "string" || !(KINDS as readonly string[]).includes(raw.kind)) {
    return null;
  }
  const kind = raw.kind as FeedbackKind;

  if (typeof raw.url !== "string" || raw.url.length > MAX_URL) return null;
  const urlOk =
    raw.url.startsWith("http://") ||
    raw.url.startsWith("https://") ||
    (kind === "issue" && raw.url === "");
  if (!urlOk) return null;

  const event: FeedbackEvent = {
    v: 1,
    id: raw.id,
    ts: raw.ts,
    client_id: raw.client_id,
    issue_id: raw.issue_id,
    engine: raw.engine as Engine,
    url: raw.url,
    kind,
  };

  // A verdict belongs to the whole-issue check-in and nowhere else; seeing one
  // elsewhere means the client is confused, so the event goes.
  if (raw.value !== undefined) {
    if (kind !== "issue") return null;
    if (typeof raw.value !== "string" || !(VALUES as readonly string[]).includes(raw.value)) {
      return null;
    }
    event.value = raw.value as FeedbackValue;
  }

  // Reasons are advisory, so a bad list is dropped rather than fatal.
  if (REASON_KINDS.includes(kind) && Array.isArray(raw.reasons)) {
    const seen = new Set<string>();
    for (const r of raw.reasons) {
      if (typeof r !== "string") continue;
      if (!(REASONS as readonly string[]).includes(r)) continue;
      seen.add(r);
      if (seen.size >= MAX_REASONS) break;
    }
    if (seen.size > 0) event.reasons = [...seen];
  }

  if (raw.section !== undefined) {
    if (typeof raw.section !== "string" || raw.section.length > MAX_SECTION) return null;
    event.section = raw.section;
  }

  return event;
}

export function validateBatch(body: unknown): { events: FeedbackEvent[]; rejected: number } {
  if (typeof body !== "object" || body === null) return { events: [], rejected: 0 };
  const envelope = body as Record<string, unknown>;
  if (envelope.v !== 1 || !Array.isArray(envelope.events)) return { events: [], rejected: 0 };

  // Anything past the cap is counted as rejected rather than silently ignored.
  const incoming = envelope.events.slice(0, MAX_EVENTS);
  let rejected = envelope.events.length - incoming.length;

  const events: FeedbackEvent[] = [];
  for (const candidate of incoming) {
    const event = validateEvent(candidate);
    if (event) events.push(event);
    else rejected += 1;
  }
  return { events, rejected };
}

// Exact string match only — no prefix or suffix matching, so
// "https://site.com.evil.net" can never pass for "https://site.com".
export function originAllowed(origin: string | null, allowed: string[]): boolean {
  if (!origin) return false;
  return allowed.includes(origin);
}

// One file per UTC month, e.g. "feedback/2026-09.jsonl".
export function fileFor(ts: string): string {
  const d = new Date(ts);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `feedback/${year}-${month}.jsonl`;
}

// Append-only merge: events whose id is already in the file are skipped, so a
// retried or re-sent batch can never double-count. Lines we cannot parse are
// left exactly as they are rather than dropped.
export function mergeLines(
  existing: string,
  events: FeedbackEvent[],
): { text: string; added: number } {
  const seen = new Set<string>();
  for (const line of existing.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as { id?: unknown };
      if (typeof parsed.id === "string") seen.add(parsed.id);
    } catch {
      /* malformed line — kept in the text, just not indexed */
    }
  }

  const fresh: string[] = [];
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    fresh.push(JSON.stringify(event));
  }

  let text = existing;
  if (text.length > 0 && !text.endsWith("\n")) text += "\n";
  if (fresh.length > 0) text += `${fresh.join("\n")}\n`;
  return { text, added: fresh.length };
}
