import { useEffect, useRef, useState } from "react";
import { prefersReduced } from "../lib/motion";

interface Props {
  name: string;
  portraitSrc: string;
  // Secondary line inside the box: date · reading time. Either may be empty.
  dateText?: string;
  readText?: string;
  // True while the boot cover is up: the greeting waits, so it is never typed
  // unseen. It starts from the first character the moment this turns false.
  paused?: boolean;
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

// RoboBuddy's masthead dialogue box (RPG-style): portrait + ROBOBUDDY
// nameplate + a by-name greeting that types out once on load, then rests.
// This is the one place the buddy-system lets RoboBuddy "speak" — the line
// stays a warm greeting, never an instruction or an urgent nudge.
export function BuddyDialog({ name, portraitSrc, dateText, readText, paused = false }: Props) {
  const full = `${timeGreeting()}, ${name} — here's today's pulse.`;

  // One-time typewriter; reduced-motion (and SSR-less first paint) shows it
  // whole immediately. Nothing loops, so the box is still at rest.
  const reduce = prefersReduced();
  const [shown, setShown] = useState(reduce ? full.length : 0);
  const started = useRef(false);

  useEffect(() => {
    if (reduce || paused || started.current) return;
    started.current = true;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= full.length) window.clearInterval(id);
    }, 30);
    return () => window.clearInterval(id);
    // full is derived from a per-load greeting; type it once, on the first
    // render that is not paused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // Each half of the meta line holds together, so a narrow box breaks at the
  // separator and never orphans the last word of the reading time.
  const metaParts = [dateText, readText].filter(Boolean);

  return (
    <div className="buddy-dialog">
      <span className="bd-portrait">
        <img
          className="bd-portrait-img"
          src={portraitSrc}
          alt=""
          width={418}
          height={597}
        />
      </span>
      <div className="bd-box">
        <span className="bd-nameplate">ROBOBUDDY</span>
        <p className="bd-text" aria-label={full}>
          <span aria-hidden="true">{full.slice(0, shown)}</span>
          {/* caret shows only while typing, then disappears — nothing at rest */}
          {!paused && shown < full.length && <span className="bd-cursor" aria-hidden="true" />}
        </p>
        {metaParts.length > 0 && (
          <p className="bd-meta">
            {metaParts.map((part, i) => (
              <span key={part} className="bd-meta-part">
                {i > 0 && " · "}
                <span className="bd-nowrap">{part}</span>
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
