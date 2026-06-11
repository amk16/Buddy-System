import type { Issue } from "./types";

// The buddy-system's three reading surfaces. The URL hash is the single
// source of truth: "" | "#glance" → glance, "#feed" → feed, "#<sectionId>"
// → that section. Refresh, browser back, and deep links work for free.
export type View =
  | { mode: "glance" }
  | { mode: "feed" }
  | { mode: "section"; sectionId: string };

export function parseHash(hash: string, issue: Issue | null): View {
  const id = hash.replace(/^#/, "");
  if (!id || id === "glance") return { mode: "glance" };
  if (id === "feed") return { mode: "feed" };
  if (issue?.sections.some((s) => s.id === id && s.items.length > 0)) {
    return { mode: "section", sectionId: id };
  }
  return { mode: "glance" };
}

export function viewToHash(view: View): string {
  if (view.mode === "glance") return "";
  if (view.mode === "feed") return "#feed";
  return `#${view.sectionId}`;
}
