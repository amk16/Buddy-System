// The server-side copy of the feedback event contract. It deliberately
// duplicates frontend/src/lib/types.ts instead of importing it: the deployed
// function bundle must not pull in app code. Keep the two in sync (and
// backend/reader_profile.py, which reads the stored lines).

export const KINDS = [
  "more",
  "loved",
  "less",
  "undo",
  "open",
  "click",
  "issue",
] as const;
export type FeedbackKind = (typeof KINDS)[number];

export const VALUES = ["useful", "fine", "noise"] as const;
export type FeedbackValue = (typeof VALUES)[number];

export const ENGINES = ["claude", "gemini"] as const;
export type Engine = (typeof ENGINES)[number];

// Reason chips. Each one maps to a lever the curator can actually pull, which
// is what makes a negative reaction steerable rather than just discouraging.
// Provisional: the reaction-component design finalises this list.
export const REASONS = [
  "client_ready",
  "learned_something",
  "good_numbers",
  "worth_following",
  "my_industry",
  "too_technical",
  "not_my_clients",
  "already_knew",
  "no_numbers",
  "off_topic",
  "source",
] as const;

// Reasons only make sense on a deliberate reaction.
export const REASON_KINDS: readonly FeedbackKind[] = ["more", "loved", "less"];

export const MAX_REASONS = 10;
// Largest request body we will read at all, in bytes.
export const MAX_BODY = 64 * 1024;
// Largest number of events one request may carry.
export const MAX_EVENTS = 100;

export interface FeedbackEvent {
  v: 1;
  id: string;
  ts: string;
  client_id: string;
  issue_id: string;
  engine: Engine;
  url: string;
  kind: FeedbackKind;
  reasons?: string[];
  value?: FeedbackValue;
  section?: string;
}
