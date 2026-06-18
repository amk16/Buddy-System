// Live geometry of the glance bento, used to aim the section morph: the
// clicked box grows to fill the whole glance area while every other named
// element collapses toward that area's center (and grows back out on return).
//
// We cache element centers RELATIVE to the .glance box. The translate a view-
// transition snapshot needs is (areaCenter − elementCenter) in viewport px —
// and because both are captured in the same frame, the area-relative form
// equals the viewport delta (the shared offset cancels), so it's immune to
// scroll position. Captured while glance is mounted; reused for the reverse
// (back) animation when glance is no longer in the DOM.

export interface Vector {
  dx: number;
  dy: number;
}

interface Store {
  // area center, expressed relative to the area's own top-left: (w/2, h/2)
  areaCenter: { x: number; y: number } | null;
  // element center relative to the area's top-left, keyed by view-transition-name
  centers: Map<string, { x: number; y: number }>;
}

const store: Store = { areaCenter: null, centers: new Map() };

// Read every [data-vt] element inside the glance and record its center.
export function captureGlanceGeometry(glanceEl: HTMLElement): void {
  const area = glanceEl.getBoundingClientRect();
  const centers = new Map<string, { x: number; y: number }>();
  glanceEl.querySelectorAll<HTMLElement>("[data-vt]").forEach((el) => {
    const name = el.dataset.vt;
    if (!name) return;
    const r = el.getBoundingClientRect();
    centers.set(name, {
      x: r.left - area.left + r.width / 2,
      y: r.top - area.top + r.height / 2,
    });
  });
  store.areaCenter = { x: area.width / 2, y: area.height / 2 };
  store.centers = centers;
}

// Per-sibling vectors pointing from each element toward the area center.
// Excludes the active (morphing) name — that box uses the built-in group
// morph, not a manual translate. Empty when nothing has been captured yet
// (e.g. a deep link straight into a section), which the caller treats as
// "no collapse, plain morph".
export function getCollapseVectors(activeName: string): Record<string, Vector> {
  const out: Record<string, Vector> = {};
  if (!store.areaCenter) return out;
  for (const [name, c] of store.centers) {
    if (name === activeName) continue;
    out[name] = { dx: store.areaCenter.x - c.x, dy: store.areaCenter.y - c.y };
  }
  return out;
}
