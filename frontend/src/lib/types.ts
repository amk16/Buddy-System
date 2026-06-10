// TypeScript mirror of issue.json — the contract with the Python backend.
// Keep in sync with backend/curator.py and backend/store.py.

export type SignalTag = "trending" | "new" | "shift";

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
  brief: Item[];
  sections: Section[];
}

export interface IndexEntry {
  id: string;
  generated_at: string;
  title: string;
  item_count: number;
}
