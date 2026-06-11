import type { Issue } from "./types";

// Powers the optional "pick up where you left off" chip. One key, one entry —
// no unbounded growth. Every call tolerates storage being unavailable
// (private browsing, blocked storage).

const KEY = "pulse.lastVisited.v1";

export interface LastVisited {
  issueId: string;
  sectionId: string;
  visitedAt: string;
}

export function save(issueId: string, sectionId: string): void {
  try {
    const entry: LastVisited = {
      issueId,
      sectionId,
      visitedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    /* storage unavailable — the chip just never appears */
  }
}

export function load(issueId: string, issue: Issue): LastVisited | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as LastVisited;
    if (entry.issueId !== issueId) return null;
    if (!issue.sections.some((s) => s.id === entry.sectionId && s.items.length > 0)) {
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
