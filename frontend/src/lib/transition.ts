import { flushSync } from "react-dom";
import type { Vector } from "./glanceGeometry";

// A glance↔section morph: one box (activeName) grows to fill the glance area
// via the browser's built-in shared-element group animation; every other named
// element (vectors) collapses toward — or grows out from — the area center.
export interface MorphSpec {
  activeName: string;
  direction: "forward" | "back";
  vectors: Record<string, Vector>;
}

// Build the per-transition stylesheet. Per-sibling vectors can't ride on :root
// (one value per custom property), so each name gets its own rule setting
// --vx/--vy on its group pseudo; the old/new pseudos inherit those and a
// single shared @keyframes (in index.css) reads them. Longhand animation-*
// only — the `animation` shorthand would reset duration to 0s and play instant,
// fighting the global ::view-transition-*(*) duration rule.
function morphStyleText(spec: MorphSpec): string {
  const pseudo = spec.direction === "forward" ? "old" : "new";
  const anim = spec.direction === "forward" ? "pulse-collapse" : "pulse-expand";
  const timing =
    "animation-duration:var(--motion-md);" +
    "animation-timing-function:var(--ease-settle);animation-fill-mode:both;";

  let css = "";
  for (const [name, v] of Object.entries(spec.vectors)) {
    css += `::view-transition-group(${name}){--vx:${v.dx}px;--vy:${v.dy}px;z-index:1;}`;
    css += `::view-transition-${pseudo}(${name}){animation-name:${anim};${timing}}`;
  }
  // The growing box rides above the collapsing siblings, and its content fades
  // asymmetrically (old out fast, new in late) so the stretched mid-morph
  // snapshots are never both fully visible.
  css += `::view-transition-group(${spec.activeName}){z-index:10;}`;
  css += `::view-transition-old(${spec.activeName}){animation-name:pulse-morph-old;${timing}}`;
  css += `::view-transition-new(${spec.activeName}){animation-name:pulse-morph-new;${timing}}`;
  return css;
}

// All buddy-system view changes go through here. flushSync is required:
// startViewTransition snapshots the DOM after its callback resolves, and a
// batched React setState would commit too late, animating from a stale frame.
// Reduced motion and unsupporting browsers get an instant swap.
export function withViewTransition(update: () => void, morph?: MorphSpec) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) {
    update();
    return;
  }

  let styleEl: HTMLStyleElement | null = null;
  if (morph) {
    styleEl = document.createElement("style");
    styleEl.textContent = morphStyleText(morph);
    document.head.appendChild(styleEl);
  }

  const transition = document.startViewTransition(() => {
    flushSync(update);
  });
  transition.finished.finally(() => styleEl?.remove());
}
