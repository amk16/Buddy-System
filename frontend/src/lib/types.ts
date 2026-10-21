// TypeScript mirror of issue.json — the contract with the Python backend.
// Keep in sync with backend/curator.py and backend/store.py.

export type SignalTag = "trending" | "new" | "shift";

// Which engine produced an issue. Both Claude paths (Claude Code --write and the
// Anthropic API) read as "claude"; the autonomous stream is "gemini".
export type Engine = "claude" | "gemini";

// Fixed tab order (Claude first — the human-reviewed default), independent of
// which engines currently have issues. It lives here rather than beside the
// tab component so that component file stays components-only.
export const ENGINE_ORDER: Engine[] = ["claude", "gemini"];

// A plain-English definition for a technical term on a card.
export interface Term {
  term: string;
  definition: string;
}

export interface Item {
  section: string;
  headline: string;
  // Plain 2–4 sentence brief (who/what/where/when/how, implicit). Optional so
  // pre-v1.1 issues that lack it still render.
  summary?: string;
  why_it_matters: string;
  // Short glossary for jargon on this card. Optional / may be empty.
  terms?: Term[];
  url: string;
  source_name: string;
  signal_tag: SignalTag;
  published_at?: string | null;
}

export interface Section {
  id: string;
  label: string;
  items: Item[];
}

export interface Issue {
  id: string;
  generated_at: string;
  title: string;
  // Producing engine. Optional so pre-tagging issues still type-check.
  engine?: Engine;
  brief: Item[];
  sections: Section[];
}

export interface IndexEntry {
  id: string;
  generated_at: string;
  title: string;
  item_count: number;
  // Producing engine; older entries are backfilled to "claude" by the index.
  engine: Engine;
}

// ---------------------------------------------------------------------------
// Reader feedback events — the contract shared with frontend/api/_lib/schema.ts
// and backend/reader_profile.py. Keep the three in sync.
// ---------------------------------------------------------------------------

// What the reader did. "more"/"loved"/"less"/"undo" are explicit reactions to a
// card; "issue" is the whole-issue check-in; "open" (a card's Details expanded)
// and "click" (a headline followed) are logged silently and weigh far less.
export type FeedbackKind =
  | "more"
  | "loved"
  | "less"
  | "undo"
  | "open"
  | "click"
  | "issue";

// The whole-issue verdict, only ever sent with kind === "issue".
export type FeedbackValue = "useful" | "fine" | "noise";

export interface FeedbackEvent {
  // Schema version, so the stored JSONL can be migrated later.
  v: 1;
  id: string;
  // ISO-8601 UTC timestamp, e.g. "2026-09-22T10:00:00.000Z".
  ts: string;
  // Anonymous per-browser id — no account, no personal data.
  client_id: string;
  issue_id: string;
  engine: Engine;
  // The item's raw url as stored in the issue; "" only when kind === "issue".
  url: string;
  kind: FeedbackKind;
  // Reason chips, only with the explicit kinds ("more" / "loved" / "less").
  reasons?: string[];
  // Only with kind === "issue".
  value?: FeedbackValue;
  section?: string;
}
