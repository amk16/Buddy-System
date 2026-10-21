import * as feedback from "./feedback";

// What Kajol marked, and how a mark becomes events.
//
// Two jobs, deliberately kept together because they are the same fact: the
// level a card is sitting at. The store remembers it across reloads so a
// reopened issue still shows her marks, and it turns every change into the
// event pair the backend resolver expects.
//
// The resolver (backend/reader_profile.py resolve_reactions) pops the most
// recent explicit reaction for a card when it meets an "undo", and a stray
// "undo" is a no-op. So every explicit send is preceded by one: if the local
// mirror was ever evicted or lost, the resend still replaces rather than adds.
//
// Nothing here is allowed to break the page. A blocked localStorage costs the
// memory of past issues, never an exception in the reader's face.

const KEY = "pulse.reactions.v1";
// How many issues keep their marks. Eviction is by `touched`, never by id:
// a same-day second issue ("2026-09-22-2") sorts below the next day as a
// string, so an id-ordered eviction would throw away the wrong one.
const MAX_ISSUES = 5;

// Three states on the card. The backend kind "less" is still accepted by the
// API and still understood by the resolver, but v3 removed the dislike from the
// card, so nothing here ever produces one again.
export type Level = "none" | "more" | "loved";

export interface Entry {
  level: Level;
  reasons: string[];
}

interface Bucket {
  touched: string;
  urls: Record<string, Entry>;
}

type Store = Record<string, Bucket>;

// One shared frozen object for every unmarked card, so useSyncExternalStore
// sees a stable snapshot and never re-renders a card nobody touched.
export const EMPTY: Entry = Object.freeze({
  level: "none" as Level,
  reasons: Object.freeze([]) as unknown as string[],
});

// The reason chips, split by which way the reaction points. Ids are fixed by
// frontend/api/_lib/schema.ts and must not drift from it.
export const REASONS_POSITIVE = [
  "client_ready",
  "learned_something",
  "good_numbers",
  "worth_following",
  "my_industry",
] as const;

export const REASONS_NEGATIVE = [
  "too_technical",
  "not_my_clients",
  "already_knew",
  "no_numbers",
  "off_topic",
  "source",
] as const;

export const REASON_LABELS: Record<string, string> = {
  client_ready: "Client-ready",
  learned_something: "Taught me something",
  good_numbers: "Good numbers",
  worth_following: "Worth following",
  my_industry: "My industry",
  too_technical: "Too technical",
  not_my_clients: "Not my clients",
  already_knew: "Already knew",
  no_numbers: "No numbers",
  off_topic: "Off topic",
  source: "Not this source",
};

// Every id the API will accept. Anything else in storage is a stale build or a
// foreign value, and is dropped rather than resent.
const KNOWN_REASONS = new Set<string>([...REASONS_POSITIVE, ...REASONS_NEGATIVE]);

/**
 * Which chips belong to a level. None means no Why row at all.
 *
 * Only the positive set is ever reachable now. REASONS_NEGATIVE stays exported
 * because the API and the backend still know those ids, and older stored
 * reactions may still carry them.
 */
export function reasonsFor(level: Level): readonly string[] {
  return level === "none" ? [] : REASONS_POSITIVE;
}

// ── module state ───────────────────────────────────────────────────────────

// null until the first read; after that the mirror is the source of truth, so
// entry objects keep their identity between snapshots.
let mem: Store | null = null;
let storageOk = true;
let issueId = "";
let listeners: Array<() => void> = [];

// ── storage ────────────────────────────────────────────────────────────────

const LEVELS: Level[] = ["none", "more", "loved"];

// Cheap shape check so a corrupted or foreign value in our key cannot poison
// the mirror. Anything unrecognisable is simply forgotten, which is also how a
// dislike stored by an older build quietly disappears.
function sanitize(value: unknown): Store {
  const out: Store = {};
  if (typeof value !== "object" || value === null) return out;
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "object" || raw === null) continue;
    const bucket = raw as Partial<Bucket>;
    if (typeof bucket.touched !== "string") continue;
    const urls: Record<string, Entry> = {};
    for (const [url, entry] of Object.entries(bucket.urls ?? {})) {
      const e = entry as Partial<Entry>;
      if (!LEVELS.includes(e.level as Level) || e.level === "none") continue;
      urls[url] = freezeEntry(
        e.level as Level,
        Array.isArray(e.reasons)
          ? e.reasons.filter((r) => typeof r === "string" && KNOWN_REASONS.has(r))
          : [],
      );
    }
    out[id] = { touched: bucket.touched, urls };
  }
  return out;
}

function freezeEntry(level: Level, reasons: string[]): Entry {
  return Object.freeze({ level, reasons: Object.freeze([...reasons]) }) as Entry;
}

function read(): Store {
  if (mem !== null) return mem;
  if (!storageOk) {
    mem = {};
    return mem;
  }
  try {
    const raw = localStorage.getItem(KEY);
    mem = sanitize(raw ? JSON.parse(raw) : {});
  } catch {
    // Either storage is gone or the value is junk; memory takes over.
    storageOk = false;
    mem = {};
  }
  return mem;
}

function persist(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    storageOk = false;
  }
}

// An issue with nothing marked on it is not a memory, so it gives its slot back
// first; beyond MAX_ISSUES the least recently touched of the rest falls off.
function evict(store: Store): Store {
  const next: Store = { ...store };
  for (const id of Object.keys(next)) {
    if (Object.keys(next[id].urls).length === 0) delete next[id];
  }
  const ids = Object.keys(next);
  if (ids.length <= MAX_ISSUES) return next;
  const ordered = ids.sort((a, b) => next[a].touched.localeCompare(next[b].touched));
  for (const id of ordered.slice(0, ids.length - MAX_ISSUES)) delete next[id];
  return next;
}

// ── the store ──────────────────────────────────────────────────────────────

/** The issue whose marks are on screen. Called before feedback.setContext. */
export function setIssue(id: string): void {
  if (id === issueId) return;
  issueId = id;
  // Different issue, different marks: every subscribed card is now reading from
  // another bucket and has to look again.
  notify();
}

function notify(): void {
  for (const l of listeners) l();
}


/** The current mark for a card. Same reference until that card changes. */
export function getEntry(url: string): Entry {
  const bucket = read()[issueId];
  return bucket?.urls[url] ?? EMPTY;
}

export function subscribe(onChange: () => void): () => void {
  listeners = listeners.concat(onChange);
  return () => {
    listeners = listeners.filter((l) => l !== onChange);
  };
}

// Replace one card's entry, leaving every other entry object untouched so their
// snapshots stay stable, then persist and notify.
function commit(url: string, next: Entry | null): void {
  const store = read();
  const bucket = store[issueId] ?? { touched: "", urls: {} };
  const urls = { ...bucket.urls };
  if (next === null) delete urls[url];
  else urls[url] = next;

  mem = evict({
    ...store,
    [issueId]: { touched: new Date().toISOString(), urls },
  });
  persist(mem);
  notify();
}

// The event pair. The undo takes back whatever the backend still holds for this
// card; the explicit event, when there is one, says what it is now.
function emit(url: string, section: string, level: Level, reasons: string[]): void {
  feedback.record({ kind: "undo", url, section });
  if (level === "none") return;
  feedback.record({ kind: level, url, section, reasons });
}

/**
 * Put a card at a level, or at "none" to clear it.
 *
 * The store does what it is told. The caller owns the gestures: a tap climbs,
 * a held press asks for "none". A level change always starts the reasons over,
 * because an unchanged chip set under a level she just changed would be a
 * guess about what she still means.
 */
export function setLevel(url: string, section: string, level: Level): void {
  commit(url, level === "none" ? null : freezeEntry(level, []));
  emit(url, section, level, []);
}

/** Add or remove one chip, then resend the reaction carrying the whole list. */
export function toggleReason(url: string, section: string, reason: string): void {
  const entry = getEntry(url);
  if (entry.level === "none") return;
  const reasons = entry.reasons.includes(reason)
    ? entry.reasons.filter((r) => r !== reason)
    : [...entry.reasons, reason];
  commit(url, freezeEntry(entry.level, reasons));
  emit(url, section, entry.level, reasons);
}

// Test seam: wipe the module-level state between cases.
export function _resetForTests(): void {
  mem = null;
  storageOk = true;
  issueId = "";
  listeners = [];
}
