import type { Engine, FeedbackEvent } from "./types";

// The reader-feedback transport. Nothing here is allowed to break the page: a
// blocked localStorage or a dead endpoint must end in silence, never an
// exception.
//
// Shape of the loop: record() drops an event on a queue held in localStorage
// (with an in-memory mirror), and flush() ships the oldest batch to the
// collector. Events leave the queue only once the server has accepted them, so
// a dropped connection costs nothing but a retry.
//
// One transport: fetch with `keepalive`, which the browser is obliged to finish
// even after the page goes away. On an unload the promise usually never settles,
// so those events simply stay queued and go out on the next visit — the
// collector deduplicates by event id, so a resend can never double-count.

const QUEUE_KEY = "pulse.feedback.v1";
const CLIENT_KEY = "pulse.client.v1";
const DEFAULT_ENDPOINT = "/api/feedback";

// Never hoard more than this many unsent events — the oldest fall off first.
export const MAX_QUEUE = 200;
// How many events go in one request.
export const FLUSH_BATCH = 50;
// Quiet time after the last event before we ship what we have.
const IDLE_MS = 4000;
// After a refused send we back off 4 s, 8 s, 16 s and then stop trying until
// something new happens. A broken endpoint must not turn into a poll.
const MAX_RETRIES = 3;

// ── module state ───────────────────────────────────────────────────────────

// The in-memory mirror of the queue. It becomes the single source of truth the
// moment localStorage refuses us (private browsing, quota, blocked storage).
let mem: FeedbackEvent[] = [];
let storageOk = true;
let cachedClientId: string | null = null;
let context: { issue_id: string; engine: Engine } = {
  issue_id: "",
  engine: "claude",
};
let idleTimer: ReturnType<typeof setTimeout> | null = null;
// One request at a time, so two flushes can never send the same batch twice.
let inFlight = false;
// Consecutive refused sends. Reset by a success or by anything new to say.
let failures = 0;
// Cards whose Details panel has already been logged for the current issue —
// "she looked closer" is worth one event, not one per expand.
let openedUrls = new Set<string>();

// ── ids and storage ────────────────────────────────────────────────────────

// A unique id. crypto.randomUUID is standard in current browsers; the fallback
// covers old ones and non-secure contexts (where randomUUID is unavailable).
function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to the cheap id */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Anonymous, per-browser. Created once and kept so a reader's events can be
// grouped without knowing who she is.
function clientId(): string {
  if (cachedClientId) return cachedClientId;
  try {
    const raw = localStorage.getItem(CLIENT_KEY);
    if (raw) {
      cachedClientId = raw;
      return raw;
    }
  } catch {
    /* storage unreadable — fall through and keep one for this page load */
  }
  const id = newId();
  cachedClientId = id;
  try {
    localStorage.setItem(CLIENT_KEY, id);
  } catch {
    /* not persisted; the id still holds for this session */
  }
  return id;
}

// Cheap shape check so a corrupted or foreign value in our key can't poison the
// queue. Full validation happens server-side.
function looksLikeEvent(value: unknown): value is FeedbackEvent {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Partial<FeedbackEvent>;
  return e.v === 1 && typeof e.id === "string" && typeof e.kind === "string";
}

function readQueue(): FeedbackEvent[] {
  if (!storageOk) return mem;
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    mem = Array.isArray(parsed) ? parsed.filter(looksLikeEvent) : [];
  } catch {
    // Either storage is gone or the value is junk; memory takes over.
    storageOk = false;
  }
  return mem;
}

function writeQueue(next: FeedbackEvent[]): void {
  mem = next;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  } catch {
    storageOk = false;
  }
}

// Drop the given ids from whatever the queue looks like *now*, so an event
// recorded while a request was in flight is never thrown away with the batch.
function removeIds(ids: string[]): void {
  const sent = new Set(ids);
  writeQueue(readQueue().filter((e) => !sent.has(e.id)));
}

// ── the idle timer ─────────────────────────────────────────────────────────

function disarm(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function arm(delayMs: number = IDLE_MS): void {
  disarm();
  idleTimer = setTimeout(() => {
    idleTimer = null;
    flush();
  }, delayMs);
}

// ── public API ─────────────────────────────────────────────────────────────

// The issue currently on screen. Every event inherits it unless it says
// otherwise.
export function setContext(ctx: { issue_id: string; engine: Engine }): void {
  // A different issue means different cards, so the "already opened" memory
  // starts over. Re-setting the same issue leaves it alone.
  if (ctx.issue_id !== context.issue_id) openedUrls = new Set<string>();
  context = { issue_id: ctx.issue_id, engine: ctx.engine };
}

// What a caller supplies: the kind and the url are required, everything else is
// either filled from the context or genuinely optional.
export type FeedbackInput = Pick<FeedbackEvent, "kind" | "url"> &
  Partial<Pick<FeedbackEvent, "reasons" | "value" | "section" | "issue_id" | "engine">>;

export function record(input: FeedbackInput): void {
  try {
    // Expanding the same card again says nothing new.
    if (input.kind === "open") {
      if (openedUrls.has(input.url)) return;
      openedUrls.add(input.url);
    }

    const event: FeedbackEvent = {
      v: 1,
      id: newId(),
      ts: new Date().toISOString(),
      client_id: clientId(),
      issue_id: input.issue_id ?? context.issue_id,
      engine: input.engine ?? context.engine,
      url: input.url,
      kind: input.kind,
    };
    if (input.reasons && input.reasons.length > 0) event.reasons = input.reasons;
    if (input.value) event.value = input.value;
    if (input.section) event.section = input.section;

    const next = readQueue().concat(event);
    // Cap the queue by dropping from the front (the oldest events).
    writeQueue(next.length > MAX_QUEUE ? next.slice(next.length - MAX_QUEUE) : next);
    // Something new to say: forgive the past failures and try again promptly.
    failures = 0;
    arm();
  } catch {
    /* feedback is never worth an error in the reader's face */
  }
}

// Where the batch goes. An explicit override wins; otherwise the Vercel
// Function that sits next to the app.
function endpointOverride(): string | undefined {
  const value = import.meta.env.VITE_FEEDBACK_ENDPOINT;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function flush(opts?: { unload?: boolean }): void {
  const unload = opts?.unload === true;
  try {
    // A second send while one is open would put the same batch on the wire
    // twice, so it waits — and re-arms, so anything recorded mid-flight is not
    // left sitting there once the open request lands.
    if (inFlight) {
      if (!unload) arm();
      return;
    }
    disarm();
    const batch = readQueue().slice(0, FLUSH_BATCH);
    if (batch.length === 0) return;

    // `vite dev` with no override posts nowhere: the batch is printed and
    // dropped, so local clicking never writes to the real collector.
    const override = endpointOverride();
    if (import.meta.env.DEV && !override) {
      console.debug("[feedback]", batch);
      removeIds(batch.map((e) => e.id));
      return;
    }

    const url = override ?? DEFAULT_ENDPOINT;
    const body = JSON.stringify({ v: 1, events: batch });
    const ids = batch.map((e) => e.id);

    // keepalive lets the request outlive the page, which is what makes one
    // transport enough for the idle, hidden and unload cases alike.
    inFlight = true;
    try {
      void fetch(url, {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body,
      })
        .then((res) => {
          inFlight = false;
          if (res && res.ok) {
            failures = 0;
            removeIds(ids);
          } else if (res && res.status === 400) {
            // The server rejected the whole batch outright (a malformed
            // payload), not a transient or auth problem. Retrying the same
            // batch would only wedge the queue behind it forever, so it is
            // dropped and whatever is queued behind it goes out normally.
            console.warn("[feedback] send rejected (400), dropping batch");
            removeIds(ids);
          } else {
            retryLater(unload, res ? res.status : 0);
          }
        })
        .catch(() => {
          inFlight = false;
          retryLater(unload, 0);
        });
    } catch {
      // fetch missing or refused outright — the events stay queued.
      inFlight = false;
    }
  } catch {
    /* never throws */
  }
}

// A refused send. The events stay queued; we warn once per run of failures so a
// misconfigured origin allowlist is visible in the console instead of silent,
// then back off and eventually stop.
function retryLater(unload: boolean, status: number): void {
  if (failures === 0) console.warn("[feedback] send failed", status);
  failures += 1;
  // Retrying during an unload is pointless — the page is already going.
  if (unload || failures > MAX_RETRIES) return;
  arm(IDLE_MS * 2 ** (failures - 1));
}

// Ship whatever is queued when the tab goes away. Returns the cleanup so a
// React effect can undo it.
export function install(): () => void {
  const onVisibility = () => {
    if (document.visibilityState === "hidden") flush({ unload: true });
  };
  const onPageHide = () => flush({ unload: true });

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
  };
}

// Test seam: wipe the module-level state between cases.
export function _resetForTests(): void {
  disarm();
  mem = [];
  storageOk = true;
  cachedClientId = null;
  context = { issue_id: "", engine: "claude" };
  inFlight = false;
  failures = 0;
  openedUrls = new Set<string>();
}
