import { useCallback, useId } from "react";

// The pixel heart the reaction mark wears.
//
// Seven cells wide and six tall, drawn on whole-pixel geometry so every edge
// lands on a device pixel. Only the heart's own cells exist; there is no dim
// grid behind it, so the shape is a recognisable object before it is a state.
//
// Super like is a physically larger rig rather than a scaled one: same 27
// cells, same 4px cell, a 2px gap instead of 1px. A transform would have
// resampled the whole thing, rounding the outline to a soft 1 to 2px and
// blurring the cells; widening the gap keeps every edge crisp at both sizes.
//
// Fills arrive from the stylesheet, keyed on the button's data-level and on
// :nth-child. Nothing here sets a fill or a style attribute on a cell.

// Column, row, row major. :nth-child follows this order, and so do the --r and
// --d tables in index.css. Anything added to the SVG goes AFTER the cells, so
// their indices are never disturbed.
//
//   . X X . X X .
//   X X X X X X X
//   X X X X X X X
//   . X X X X X .
//   . . X X X . .
//   . . . X . . .
const CELLS: Array<[number, number]> = [
  [1, 0], [2, 0], [4, 0], [5, 0],
  [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
  [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
  [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
  [2, 4], [3, 4], [4, 4],
  [3, 5],
];

// Cell side, and the pitch (cell plus gap) at each size.
const CELL = 4;
const PITCH = { small: 5, large: 6 };

// Ink box per size: 6 pitches plus one cell across, 5 plus one down.
const INK = {
  small: { w: 6 * PITCH.small + CELL, h: 5 * PITCH.small + CELL },
  large: { w: 6 * PITCH.large + CELL, h: 5 * PITCH.large + CELL },
};

// The silhouette, traced along the outside of the cells with the stroke centre
// half a pixel out, so a 1px stroke covers exactly one whole pixel. The part
// that falls outside the viewBox still renders, because .mark-rig is
// overflow: visible, so this changed no layout box anywhere. It is the non-hue
// half of "super like": at that level alone the shape gains an edge, which
// survives a greyscale reading in a way that #938d7e against #f6b53d does not.
const SILHOUETTE = {
  small:
    "M-0.5 4.5 L4.5 4.5 L4.5 -0.5 L14.5 -0.5 L14.5 4.5 L19.5 4.5 L19.5 -0.5 " +
    "L29.5 -0.5 L29.5 4.5 L34.5 4.5 L34.5 14.5 L29.5 14.5 L29.5 19.5 " +
    "L24.5 19.5 L24.5 24.5 L19.5 24.5 L19.5 29.5 L14.5 29.5 L14.5 24.5 " +
    "L9.5 24.5 L9.5 19.5 L4.5 19.5 L4.5 14.5 L-0.5 14.5 Z",
  large:
    "M-0.5 5.5 L5.5 5.5 L5.5 -0.5 L17.5 -0.5 L17.5 5.5 L23.5 5.5 L23.5 -0.5 " +
    "L35.5 -0.5 L35.5 5.5 L40.5 5.5 L40.5 17.5 L35.5 17.5 L35.5 23.5 " +
    "L29.5 23.5 L29.5 29.5 L23.5 29.5 L23.5 34.5 L17.5 34.5 L17.5 29.5 " +
    "L11.5 29.5 L11.5 23.5 L5.5 23.5 L5.5 17.5 L-0.5 17.5 Z",
};

interface Props {
  level: "none" | "more" | "loved";
  // Which beat is playing: one pulse for like, two for super like. The
  // attribute, rather than a React key, is what restarts the animation:
  // remounting the rig would hand every cell a brand new element, and a brand
  // new element cannot transition, which would silently cancel the fill
  // stagger playing on the same landing.
  beat: "off" | "single" | "double";
  onBeatEnd: () => void;
  // Non-zero while a sweep is playing. Keyed, so a replay restarts it.
  shimmer: number;
  onShimmerEnd: () => void;
}

export function PixelHeart({
  level,
  beat,
  onBeatEnd,
  shimmer,
  onShimmerEnd,
}: Props) {
  // useId can contain colons, which url(#...) will not take.
  const uid = useId().replace(/:/g, "");
  const clipId = `heart-${uid}`;
  const gradId = `sweep-${uid}`;

  const size = level === "loved" ? "large" : "small";
  const pitch = PITCH[size];
  const { w, h } = INK[size];

  // A plain listener rather than React's onAnimationEnd: React registers the
  // vendor-prefixed name when window.AnimationEvent is missing, which is
  // exactly the case in jsdom. Memoised so a parent render does not detach and
  // re-attach it every time.
  //
  // The listener sits on the svg itself, but `animationend` bubbles, so the
  // shimmer rect's own end (a child of this svg) would otherwise reach it too
  // and clear the beat early. The target/currentTarget check keeps this
  // listener answering only for the svg's own animation.
  const beatRef = useCallback(
    (el: SVGSVGElement | null) => {
      const onEnd = (e: Event) => {
        if (e.target !== e.currentTarget) return;
        onBeatEnd();
      };
      el?.addEventListener("animationend", onEnd);
      return () => el?.removeEventListener("animationend", onEnd);
    },
    [onBeatEnd],
  );
  const shimmerRef = useCallback(
    (el: SVGRectElement | null) => {
      el?.addEventListener("animationend", onShimmerEnd);
      return () => el?.removeEventListener("animationend", onShimmerEnd);
    },
    [onShimmerEnd],
  );

  const cells = CELLS.map(([c, r]) => ({ c, r, x: c * pitch, y: r * pitch }));

  return (
    <svg
      className="mark-rig"
      data-beat={beat}
      aria-hidden="true"
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      ref={beatRef}
    >
      {cells.map(({ c, r, x, y }) => (
        <rect
          className="mark-cell"
          key={`${c}-${r}`}
          x={x}
          y={y}
          width={CELL}
          height={CELL}
          rx="0.75"
        />
      ))}

      {/* Everything below is after the cells, so :nth-child stays theirs. */}
      <path className="mark-halo" d={SILHOUETTE[size]} fill="none" />

      {shimmer > 0 && (
        <g key={`sweep-${shimmer}`} clipPath={`url(#${clipId})`}>
          {/* Clipped to the cells themselves, so the band never washes over the
              gaps, the notches or the button's empty corners. Three times the
              ink each way, with the band across its middle, so translating it
              corner to corner walks the crest right across the heart. */}
          <rect
            className="mark-shimmer"
            ref={shimmerRef}
            x={-w}
            y={-h}
            width={w * 3}
            height={h * 3}
            fill={`url(#${gradId})`}
          />
        </g>
      )}

      {/* The clip and the gradient serve only the shimmer, so they exist only
          while it plays: at rest they were a second copy of every cell on every
          card, half of a section page's SVG nodes, laid out for nothing. */}
      {shimmer > 0 && (
        <defs>
          <clipPath id={clipId}>
            {cells.map(({ c, r, x, y }) => (
              <rect
                key={`clip-${c}-${r}`}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx="0.75"
              />
            ))}
          </clipPath>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0.4" stopColor="var(--brand-highlight)" stopOpacity="0" />
            <stop offset="0.5" stopColor="var(--brand-highlight)" stopOpacity="0.35" />
            <stop offset="0.6" stopColor="var(--brand-highlight)" stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
    </svg>
  );
}
