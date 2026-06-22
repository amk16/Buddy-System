// RoboBuddy peek data — the single source of truth for the hover mascot.
//
// One reusable rig (drawn in BuddyPeek.tsx) wears four pixel emotions, one per
// bento section. The body stays cream (unity); the screen-glow palette, the
// emotion, and the prop change per section (the four-box story:
// discover → react → results → connect).
//
// The face is an 11×7 low-res grid echoing the mascot's pixel-screen display.
// We render every cell dim, then light the eyes ∪ mouth cells, cycling the
// section palette so the screen reads multicolour like the source render.

export interface PixelRect {
  x: number;
  y: number;
  fill: string;
}

const GRID = { cols: 11, rows: 7, cell: 4.6, gap: 1.2, x0: 29, y0: 46 };
const PITCH = GRID.cell + GRID.gap;
const OFF = "#221d17"; // dim, unlit pixel

export const CELL = GRID.cell;

type Cell = [col: number, row: number];

// Lit cells, eyes first then mouth — order drives the palette cycle.
const FACE: Record<string, Cell[]> = {
  // eager ‿ ‿ + open smile
  tools: [
    [1, 1], [2, 2], [3, 2], [4, 1], [6, 1], [7, 2], [8, 2], [9, 1],
    [3, 4], [7, 4], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5],
  ],
  // surprised ◌ ◌ + hollow O
  news: [
    [1, 2], [2, 1], [3, 2], [2, 3], [7, 2], [8, 1], [9, 2], [8, 3],
    [4, 4], [5, 4], [6, 4], [4, 5], [6, 5], [4, 6], [5, 6], [6, 6],
  ],
  // cool shades + easy smile
  case_studies: [
    [1, 2], [2, 2], [3, 2], [1, 3], [2, 3], [3, 3], [5, 2],
    [7, 2], [8, 2], [9, 2], [7, 3], [8, 3], [9, 3],
    [3, 5], [4, 6], [5, 6], [6, 6], [7, 5],
  ],
  // proud ^ ^ + big grin
  people: [
    [1, 2], [2, 1], [3, 2], [7, 2], [8, 1], [9, 2],
    [3, 4], [7, 4], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [4, 6], [5, 6], [6, 6],
  ],
};

// Harmonious per-section palette — multicolour like the source screen, but
// biased to each section's signature hue.
const PALETTE: Record<string, string[]> = {
  tools: ["#ffd24a", "#f6b53d", "#e8a33a", "#ffc24a", "#d99a2e"], // amber / gold
  news: ["#e9744a", "#f0905c", "#d6552f", "#ef9b6a", "#c9572f"], // terracotta / coral
  case_studies: ["#3fae6b", "#2bb6a6", "#7ed957", "#36c98a", "#1f9e6e"], // green / teal
  people: ["#5b8fd6", "#7fb0e0", "#a05ec9", "#3a7bd5", "#b98ad9"], // blue / violet
};

/** Does this section have a buddy? Unknown sections render nothing. */
export function hasBuddy(id: string): boolean {
  return id in FACE;
}

/** Full pixel-screen for a section: dim grid + lit, palette-cycled face cells. */
export function buildPixelFace(id: string): PixelRect[] {
  const lit = FACE[id];
  const pal = PALETTE[id];
  if (!lit || !pal) return [];

  const rects: PixelRect[] = [];
  for (let r = 0; r < GRID.rows; r++) {
    for (let c = 0; c < GRID.cols; c++) {
      rects.push({
        x: +(GRID.x0 + c * PITCH).toFixed(1),
        y: +(GRID.y0 + r * PITCH).toFixed(1),
        fill: OFF,
      });
    }
  }
  lit.forEach(([c, r], i) => {
    rects.push({
      x: +(GRID.x0 + c * PITCH).toFixed(1),
      y: +(GRID.y0 + r * PITCH).toFixed(1),
      fill: pal[i % pal.length],
    });
  });
  return rects;
}
