import type { Engine } from "./types";

// Remembers which engine tab (Claude / Gemini) Kaj last viewed, so the dashboard
// reopens where she left off. One key, one value. Every call tolerates storage
// being unavailable (private browsing, blocked storage) — it just falls back to
// the default engine.

const KEY = "pulse.engine.v1";

export function load(): Engine | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === "claude" || raw === "gemini" ? raw : null;
  } catch {
    return null;
  }
}

export function save(engine: Engine): void {
  try {
    localStorage.setItem(KEY, engine);
  } catch {
    /* storage unavailable — the choice just isn't remembered next time */
  }
}
