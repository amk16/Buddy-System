import { useEffect, useRef, useState } from "react";
import { facePalette } from "../lib/buddy";
import { BOOT_PHASES, READOUT_MS, SWEEP_START_MS } from "../lib/boot";
import { PENCIL_CELLS, PENCIL_GRID, PENCIL_INK, PENCIL_WRITE } from "../lib/pencil";

// The boot cover: "Self-test". Sanctioned motion exception 4 of 4 (SKILL.md).
//
// RoboBuddy's own screen is the instrument. Drawn large on the paper, it boots
// like a machine: a dim raster sweeps every cell once, the screen searches in
// noise, then the Scribbld pencil resolves cell by cell from its point and
// writes one ink cell. A serif readout counts in the corner (decorative: a
// timer, never bytes), the wordmark sits viewport-wide at the bottom edge, and
// the whole sheet then lifts off the top of the screen in one move with the
// finished page beneath.
//
// The housing is BuddyPeek's screen (lib/buddy.ts geometry) at viewport scale;
// the grid inside it is drawn at three times the face's resolution, 33x21
// cells of 1.5 on a 1.93 pitch (the same 63x40 footprint), so the pencil
// reads as the logo's pencil.

const GRID = { cols: PENCIL_GRID.cols, rows: PENCIL_GRID.rows, cell: 1.5, pitch: 1.93, x0: 29, y0: 46 };
const PAL = facePalette("tools"); // the amber the screen searches in
const SCAN_FILL = "#4a3f2a"; // the dim raster: lit enough to read as a sweep, not a drawing
const NOISE_CELLS = 60;
const WORDMARK = "Buddy-System";

interface Props {
  // The stamp, once the issue is in: its own date ("Wed 21 Oct 2026") and the
  // reading-time line, the product's one sanctioned reassurance. Never a count.
  dateText?: string;
  statsText?: string;
  // True once the hold has passed with no issue: the one visible word shows.
  slow?: boolean;
  // True while the cover lifts; onLeft fires when the sheet has cleared.
  leaving?: boolean;
  onLeft?: () => void;
}

type Phase = "dark" | "scan" | "noise" | "draw" | "hold";

export function BootCover({ dateText, statsText, slow: slowProp = false, leaving = false, onLeft }: Props) {
  // The word never sits beside the lift's "100": once the sheet is leaving the
  // wait is over, whatever the network did before.
  const slow = slowProp && !leaving;
  const [phase, setPhase] = useState<Phase>("dark");
  const cellRefs = useRef<(SVGRectElement | null)[]>([]);
  const root = useRef<HTMLDivElement | null>(null);
  // The readout is written straight to the DOM. A React state update sixty
  // times a second would reconcile all 693 cells for one three-digit number.
  const pctRef = useRef<HTMLSpanElement | null>(null);

  // The choreography, as a timeline flushed once per animation frame: a frame
  // costs one style recalc however many cells change in it (the sweep alone
  // has 1,386 changes; as individual timers they each forced their own). One
  // cancel on unmount leaves nothing ticking after an early drop.
  useEffect(() => {
    const timeline: { t: number; fn: () => void }[] = [];
    const at = (ms: number, fn: () => void) => timeline.push({ t: ms, fn });
    const cells = cellRefs.current;
    const n = cells.length; // CELL_COUNT, once mounted
    const cell = (c: number, r: number) => cells[r * GRID.cols + c];
    const paint = (el: SVGRectElement | null | undefined, fill: string) => {
      if (el) el.style.fill = fill;
    };
    const { scan, noise, draw, write } = BOOT_PHASES;

    // 1. raster self-test: one dim sweep across every cell, row by row
    at(SWEEP_START_MS, () => setPhase("scan"));
    cells.forEach((el, i) => {
      at(SWEEP_START_MS + i * scan.step, () => paint(el, SCAN_FILL));
      at(SWEEP_START_MS + i * scan.step + scan.dwell, () => paint(el, ""));
    });
    const scanEnd = SWEEP_START_MS + n * scan.step + scan.dwell;

    // 2. noise: the screen searches for the drawing
    at(scanEnd, () => setPhase("noise"));
    let prev: (SVGRectElement | null)[] = [];
    for (let k = 0; k < noise.frames; k += 1) {
      at(scanEnd + k * noise.step, () => {
        prev.forEach((el) => paint(el, ""));
        prev = [];
        for (let j = 0; j < NOISE_CELLS; j += 1) {
          const el = cells[Math.floor(Math.random() * n)];
          paint(el, PAL[Math.floor(Math.random() * PAL.length)]);
          prev.push(el);
        }
      });
    }
    const noiseEnd = scanEnd + noise.frames * noise.step;
    at(noiseEnd, () => prev.forEach((el) => paint(el, "")));

    // 3. the pencil resolves from its point outward
    at(noiseEnd + draw.gap, () => setPhase("draw"));
    PENCIL_CELLS.forEach(([c, r, fill], i) =>
      at(noiseEnd + draw.gap + i * draw.step, () => paint(cell(c, r), fill)),
    );
    const drawEnd = noiseEnd + draw.gap + PENCIL_CELLS.length * draw.step;

    // 4. the point writes one cell, then the drawing holds
    at(drawEnd + write.after, () => {
      paint(cell(PENCIL_WRITE[0], PENCIL_WRITE[1]), PENCIL_INK);
      setPhase("hold");
    });

    // One frame loop drives it all: due paints flush in time order, and the
    // readout counts 0 -> 99 on the same clock, eased (the last digit belongs
    // to the lift). Nothing re-renders.
    timeline.sort((a, b) => a.t - b.t);
    let next = 0;
    const t0 = performance.now();
    let raf = 0;
    let lastPct = -1;
    const tick = () => {
      const now = performance.now() - t0;
      while (next < timeline.length && timeline[next].t <= now) {
        timeline[next].fn();
        next += 1;
      }
      const p = Math.min(1, now / READOUT_MS);
      const pct = Math.min(99, Math.round((1 - Math.pow(1 - p, 2)) * 100));
      if (pct !== lastPct && pctRef.current) {
        pctRef.current.textContent = String(pct).padStart(3, "0");
        lastPct = pct;
      }
      if (next < timeline.length || p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, []);

  // The lift: one transition on the root. transitionend reports it; a fallback
  // timer covers environments that never fire the event.
  useEffect(() => {
    if (!leaving) return;
    if (pctRef.current) pctRef.current.textContent = "100";
    const el = root.current;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onLeft?.();
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === "transform") finish();
    };
    el?.addEventListener("transitionend", onEnd);
    const id = window.setTimeout(finish, BOOT_PHASES.lift + 120);
    return () => {
      el?.removeEventListener("transitionend", onEnd);
      window.clearTimeout(id);
    };
  }, [leaving, onLeft]);

  const rects = [];
  for (let r = 0; r < GRID.rows; r += 1) {
    for (let c = 0; c < GRID.cols; c += 1) {
      const i = r * GRID.cols + c;
      rects.push(
        <rect
          key={i}
          ref={(el) => {
            cellRefs.current[i] = el;
          }}
          className="boot-cell"
          x={+(GRID.x0 + c * GRID.pitch).toFixed(1)}
          y={+(GRID.y0 + r * GRID.pitch).toFixed(1)}
          width={GRID.cell}
          height={GRID.cell}
          rx={0.35}
        />,
      );
    }
  }

  return (
    <div ref={root} className={`boot-cover${leaving ? " lift" : ""}`} data-phase={phase}>
      {/* The housing is drawn a step larger than BuddyPeek's (which is tuned
          for tile size) so the corner cells sit inside the curve at this scale:
          outer rx 13, inner rx 11, with 4–5 units of screen around the grid. */}
      {/* The shadow is a box-shadow on a wrapper the exact size of the housing,
          not an SVG drop-shadow filter: a filtered SVG re-rasterises through the
          filter on every one of the cells' fill changes. */}
      <span className="boot-screen-wrap" aria-hidden="true">
        <svg className="boot-screen" viewBox="22 40 76 50" focusable="false" aria-hidden="true">
          <rect x={22} y={40} width={76} height={50} rx={13} fill="#17150f" />
          <rect x={24} y={42} width={72} height={46} rx={11} fill="#0f0d09" />
          <g>{rects}</g>
        </svg>
      </span>
      <div className="boot-readout" aria-hidden="true">
        <span className="boot-label">Booting · your pulse</span>
        <span className="boot-pct" ref={pctRef}>
          {leaving ? "100" : "000"}
        </span>
        {/* the one visible word, only when the network is slow; its line is
            reserved so nothing moves when it arrives */}
        <span className="boot-word" data-show={slow ? "true" : "false"}>
          {slow ? "Loading…" : ""}
        </span>
      </div>
      {(dateText || statsText) && (
        <div className="boot-stamp boot-label" aria-hidden="true">
          {dateText && <span>{dateText}</span>}
          {statsText && <span>{statsText}</span>}
        </div>
      )}
      <p className="boot-wordmark" aria-hidden="true">
        {WORDMARK.split("").map((ch, i) => (
          <span key={i} style={{ animationDelay: `${120 + i * 28}ms` }}>
            {ch}
          </span>
        ))}
      </p>
      <span className="boot-grain" aria-hidden="true" />
      <span className="sr-only" role="status">
        {slow ? "Still loading today's pulse" : "Loading today's pulse"}
      </span>
    </div>
  );
}
