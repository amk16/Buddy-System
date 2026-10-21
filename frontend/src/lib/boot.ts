// Timing rules for the boot cover (sanctioned motion exception 4 of 4), kept
// pure so they read as a table and test without a DOM.
//
// The cover is a deliberate intro, not a progress report: its readout counts
// on a timer, and the cover lifts once the first issue is on screen AND the
// screen's self-test (the pencil resolving) has played through. An empty or failed load drops it at
// once, with no lift, so the recovery copy is never held behind a mascot.

export type BootStatus = "loading" | "ready" | "empty" | "error";

// How long after mount the first cell lights. One painted frame is enough for
// the fill transition to have a resting value to leave from.
export const SWEEP_START_MS = 20;

import { PENCIL_CELLS, PENCIL_GRID } from "./pencil";

// The self-test choreography, in ms. Derived totals below; the component
// reads these so the law's numbers and the code's are one table.
export const BOOT_PHASES = {
  scan: { step: 1.0, dwell: 140 }, // 693 cells x 1ms, each lit 140ms: ~830ms sweep
  noise: { frames: 10, step: 80 }, // 800ms of searching, sixty cells a frame
  draw: { gap: 120, step: 7 }, // 120 cells x 7ms: the pencil resolves from its point in ~840ms
  write: { after: 420 }, // then the point writes one cell
  lift: 720, // the sheet lifts off the top
};

export const CELL_COUNT = PENCIL_GRID.cols * PENCIL_GRID.rows;

// When the written cell is on screen, measured from mount.
export const INTRO_MS =
  SWEEP_START_MS +
  CELL_COUNT * BOOT_PHASES.scan.step +
  BOOT_PHASES.scan.dwell +
  BOOT_PHASES.noise.frames * BOOT_PHASES.noise.step +
  BOOT_PHASES.draw.gap +
  PENCIL_CELLS.length * BOOT_PHASES.draw.step +
  BOOT_PHASES.write.after;

// Minimum time the cover stays up: the whole self-test, then a breath.
export const MIN_HOLD = INTRO_MS + 900;

// The corner readout counts 000 -> 099 across the whole hold, and reads 100
// only in the frame the sheet starts to lift. It never sits at 100 waiting,
// and it never says 100 beside "Loading…".
export const READOUT_MS = MIN_HOLD;

// After this much time up with no issue, the cover shows its one visible word
// ("Loading…"), so a finished face that now holds still does not read as
// stuck. Measured from mount, like MIN_HOLD.
export const SLOW_AFTER = MIN_HOLD + 1400;

export type Lift = "hold" | "lift" | "drop";

/** The cover exists only for readers who have not asked for reduced motion. */
export function shouldShowCover(reduce: boolean): boolean {
  return !reduce;
}

/** What the cover should do right now, given the load state and time up. */
export function coverCanLift(input: { status: BootStatus; elapsed: number }): Lift {
  if (input.status === "empty" || input.status === "error") return "drop";
  if (input.status === "ready" && input.elapsed >= MIN_HOLD) return "lift";
  return "hold";
}
