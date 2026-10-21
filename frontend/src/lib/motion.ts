// The one reduced-motion check. jsdom has no matchMedia, and neither do very
// old browsers, so the absence of the query is read as "no preference" rather
// than crashing the component that asked.
export function prefersReduced(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
