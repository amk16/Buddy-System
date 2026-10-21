import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Item } from "../lib/types";
import * as reactions from "../lib/reactions";
import { useHoldToClear } from "../lib/useHoldToClear";
import { prefersReduced } from "../lib/motion";
import { PixelHeart } from "./PixelScreen";

// The one control on a card: a pixel heart that lights, then glows.
//
// Three states and one element. A tap climbs none -> like -> super like, and a
// press and hold takes it back to none, which is the gesture a phone already
// uses for "undo this" and costs no second button in the row. Each stage
// answers differently, because a control that changes only its colour does not
// read as having done anything: like fills the whole heart a row at a time,
// super like warms it to amber and beats it once.

// How long the "noted" word stays up. It is also how long the status span
// holds its message, so a repeat of the same word re-announces.
const NOTED_MS = 1200;

type Level = "none" | "more" | "loved";

const LABEL: Record<Level, string> = {
  none: "Like this",
  more: "Like this, liked",
  loved: "Like this, super liked",
};

export function ReactionMarks({ item }: { item: Item }) {
  // The store is the source of truth, so a restored level is on screen at the
  // first paint: no effect, no flash, nothing to set after mount.
  const entry = useSyncExternalStore(reactions.subscribe, () =>
    reactions.getEntry(item.url),
  );
  const level = entry.level as Level;
  const [noted, setNoted] = useState("");
  // 0 = nothing playing. Any other value keys the current one-shot span.
  const [ring, setRing] = useState(0);
  const [shimmer, setShimmer] = useState(0);
  // Which beat is playing, if any. Like gets one pulse, super like gets two,
  // so the two landings never feel like the same event.
  const [beat, setBeat] = useState<"off" | "single" | "double">("off");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  // Show the landing word, then take it away on its own timer so the row never
  // grows and a later repeat is heard again.
  function land(text: string): void {
    setNoted(text);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      setNoted("");
    }, NOTED_MS);
  }

  function clear(): void {
    reactions.setLevel(item.url, item.section, "none");
    land("Cleared");
  }

  const hold = useHoldToClear({ enabled: level !== "none", onClear: clear });

  function onTap(): void {
    // The click the browser sends after a completed hold is not a tap.
    if (hold.consumeHeld()) return;

    if (level === "loved") {
      // Already at the top. Replay the shimmer and the beat so the heart still
      // answers, but record nothing and do not repeat the landing halo.
      if (!prefersReduced()) {
        setShimmer((n) => n + 1);
        setBeat("double");
      }
      // The word and the live region land either way, so a reader who cannot
      // see the shimmer still gets an answer rather than silence.
      land("Noted");
      return;
    }

    const next: Level = level === "none" ? "more" : "loved";
    reactions.setLevel(item.url, item.section, next);
    land("Noted");
    if (prefersReduced()) return;
    if (next === "loved") {
      setRing((n) => n + 1);
      setShimmer((n) => n + 1);
      setBeat("double");
    } else {
      // Like beats once. It is the only motion that stage gets, and without it
      // the row sweep alone was too easy to miss.
      setBeat("single");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>): void {
    if (level === "none") return;
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    // Backspace would otherwise be the browser's own back gesture.
    e.preventDefault();
    clear();
  }

  // The ring is the one overlay still outside the rig, because it is meant to
  // escape the ink. React registers the vendor-prefixed animation name when
  // window.AnimationEvent is missing, which is exactly the case in jsdom, so a
  // plain listener keeps the unmount contract identical in the browser and
  // under test. Memoised, so an unrelated parent render does not detach and
  // re-attach it mid-animation.
  const endShimmer = useCallback(() => setShimmer(0), []);
  const ringRef = useCallback((el: HTMLSpanElement | null) => {
    const done = () => setRing(0);
    el?.addEventListener("animationend", done);
    return () => el?.removeEventListener("animationend", done);
  }, []);
  const endBeat = useCallback(() => setBeat("off"), []);

  return (
    <>
      {/* The landing word sits before the heart, so the heart and the Details
          toggle cluster together on the right. It is always rendered at a fixed
          width, so fading it in and out never moves the row. */}
      <span className="noted" aria-hidden="true" data-show={noted !== ""}>
        {noted}
      </span>

      <button
        type="button"
        className="mark"
        data-level={level}
        data-holding={hold.holding}
        aria-label={LABEL[level]}
        aria-description="Tap to raise. Press and hold, or press Delete, to clear."
        onClick={onTap}
        onKeyDown={onKeyDown}
        {...hold.handlers}
      >
        <PixelHeart
          level={level}
          beat={beat}
          onBeatEnd={endBeat}
          shimmer={shimmer}
          onShimmerEnd={endShimmer}
        />
        {ring > 0 && (
          <span
            key={`ring-${ring}`}
            className="mark-ring"
            aria-hidden="true"
            ref={ringRef}
          />
        )}
      </button>

      <span className="sr-only" role="status">
        {noted}
      </span>
    </>
  );
}
