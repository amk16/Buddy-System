import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";

// Press and hold to clear.
//
// The mark climbs on a tap, so the way back down cannot also be a tap. A hold
// is the gesture that already means "undo this" on a phone, and it costs no
// second control on the card.
//
// Two timers run from pointerdown. The first raises a visible cue, late enough
// that an ordinary tap never flickers. The second does the clearing. Letting go
// before either one leaves the press an ordinary tap, and the browser's own
// click follows as usual.

// Long enough to be deliberate, short enough not to feel stuck.
export const HOLD_MS = 500;
// Only once the press has lasted this long does the screen start to dim.
export const HOLD_CUE_MS = 150;

interface Options {
  // False when there is nothing to clear, so a press on a resting mark is only
  // ever a tap.
  enabled: boolean;
  onClear: () => void;
}

export interface HoldToClear {
  handlers: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onPointerLeave: () => void;
    onContextMenu: (e: MouseEvent<HTMLElement>) => void;
  };
  /** True while the press has lasted long enough to show the reader it counts. */
  holding: boolean;
  /**
   * Whether the click now arriving is the one a completed hold produced, which
   * must not also be read as a tap. Answering the question clears the flag, so
   * the next real click counts.
   */
  consumeHeld: () => boolean;
}

export function useHoldToClear({ enabled, onClear }: Options): HoldToClear {
  const [holding, setHolding] = useState(false);
  const cue = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  const stop = useCallback(() => {
    if (cue.current !== null) {
      clearTimeout(cue.current);
      cue.current = null;
    }
    if (done.current !== null) {
      clearTimeout(done.current);
      done.current = null;
    }
    setHolding(false);
  }, []);

  useEffect(
    () => () => {
      if (cue.current !== null) clearTimeout(cue.current);
      if (done.current !== null) clearTimeout(done.current);
    },
    [],
  );

  // No ref for onClear: onPointerDown is a plain closure rebuilt every render,
  // so the handler the DOM actually calls is always the latest one, but once a
  // press starts, the 500ms timer it arms below still closes over whichever
  // onClear was current at that pointerdown, not any later render's. onClear's
  // identity does not change mid-press in practice, so this has never
  // surfaced, but it is a real caveat, not a "stays current" guarantee.
  const onPointerDown = (e: PointerEvent<HTMLElement>): void => {
    // A second press while one is armed would otherwise overwrite the timer
    // refs and leave the first pair running, so a two-finger press could fire
    // an orphan clear.
    stop();
    // Reset above the guard, not below it. A completed hold does not always
    // produce a click (a finger that slid off, or Safari after a long press),
    // and a flag left set would swallow the next genuine tap on what is by then
    // a resting heart.
    held.current = false;
    // A right click, a middle click or a second finger is not a hold.
    if (!enabled || e.button !== 0) return;
    cue.current = setTimeout(() => {
      cue.current = null;
      setHolding(true);
    }, HOLD_CUE_MS);
    done.current = setTimeout(() => {
      done.current = null;
      // Remember it, so the click the browser sends next is swallowed rather
      // than read as a tap that would climb the level straight back up.
      held.current = true;
      setHolding(false);
      onClear();
    }, HOLD_MS);
  };

  return {
    handlers: {
      onPointerDown,
      onPointerUp: stop,
      onPointerCancel: stop,
      onPointerLeave: stop,
      // A long press on a touch screen otherwise raises the platform's own menu
      // over the gesture we are in the middle of.
      onContextMenu: (e) => e.preventDefault(),
    },
    holding,
    consumeHeld: () => {
      const was = held.current;
      held.current = false;
      return was;
    },
  };
}
