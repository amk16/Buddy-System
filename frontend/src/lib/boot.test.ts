import { describe, expect, it } from "vitest";
import { INTRO_MS, MIN_HOLD, READOUT_MS, SLOW_AFTER, coverCanLift, shouldShowCover } from "./boot";

// The boot cover's timing, kept pure so the rules can be read as a table:
// it shows unless motion is reduced, it never lifts before its minimum hold,
// it never lifts before the first issue is on screen, and an empty or failed
// load drops it at once with no morph.

describe("shouldShowCover", () => {
  it("shows unless the reader asked for reduced motion", () => {
    expect(shouldShowCover(false)).toBe(true);
    expect(shouldShowCover(true)).toBe(false);
  });
});

describe("coverCanLift", () => {
  it("holds while the hold has not elapsed, even with the issue ready", () => {
    expect(coverCanLift({ status: "ready", elapsed: 0 })).toBe("hold");
    expect(coverCanLift({ status: "ready", elapsed: MIN_HOLD - 1 })).toBe("hold");
  });

  it("holds after the hold when the issue is still loading", () => {
    expect(coverCanLift({ status: "loading", elapsed: MIN_HOLD })).toBe("hold");
    expect(coverCanLift({ status: "loading", elapsed: MIN_HOLD * 10 })).toBe("hold");
  });

  it("lifts once both are true", () => {
    expect(coverCanLift({ status: "ready", elapsed: MIN_HOLD })).toBe("lift");
    expect(coverCanLift({ status: "ready", elapsed: MIN_HOLD + 500 })).toBe("lift");
  });

  it("drops at once, with no lift, when there is nothing to show", () => {
    expect(coverCanLift({ status: "empty", elapsed: 0 })).toBe("drop");
    expect(coverCanLift({ status: "error", elapsed: 0 })).toBe("drop");
    expect(coverCanLift({ status: "error", elapsed: MIN_HOLD * 2 })).toBe("drop");
  });

  it("says its word only after the self-test has finished and held", () => {
    expect(SLOW_AFTER).toBeGreaterThan(MIN_HOLD + 1000);
    expect(SLOW_AFTER).toBeLessThanOrEqual(MIN_HOLD + 1500);
  });

  it("counts the readout across the whole hold, so 100 belongs to the lift", () => {
    expect(READOUT_MS).toBe(MIN_HOLD);
  });

  it("holds for the whole self-test and a breath, about four seconds (slowed 2026-10-22)", () => {
    expect(INTRO_MS).toBeGreaterThan(2500);
    expect(MIN_HOLD).toBeGreaterThan(INTRO_MS);
    expect(MIN_HOLD).toBeLessThanOrEqual(5800);
  });
});
