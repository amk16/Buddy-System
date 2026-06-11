import { flushSync } from "react-dom";

// All buddy-system view changes go through here. flushSync is required:
// startViewTransition snapshots the DOM after its callback resolves, and a
// batched React setState would commit too late, animating from a stale frame.
// Reduced motion and unsupporting browsers get an instant swap.
export function withViewTransition(update: () => void) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) {
    update();
    return;
  }
  document.startViewTransition(() => {
    flushSync(update);
  });
}
