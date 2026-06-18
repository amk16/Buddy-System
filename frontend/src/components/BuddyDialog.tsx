import { useEffect, useState } from "react";

interface Props {
  name: string;
  portraitSrc: string;
  // Secondary line inside the box: date · reading time. Either may be empty.
  dateText?: string;
  readText?: string;
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
export function BuddyDialog({ name, portraitSrc, dateText, readText }: Props) {
  const full = `${timeGreeting()}, ${name} — here's today's pulse.`;

  // One-time typewriter; reduced-motion (and SSR-less first paint) shows it
  // whole immediately. Nothing loops, so the box is still at rest.
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(reduce ? full.length : 0);

  useEffect(() => {
    if (reduce) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= full.length) window.clearInterval(id);
    }, 30);
    return () => window.clearInterval(id);
    // full is derived from a per-load greeting; type it once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = [dateText, readText].filter(Boolean).join(" · ");

  return (
    <div className="buddy-dialog">
      <img
        className="bd-portrait"
        src={portraitSrc}
        alt=""
        width={76}
        height={76}
      />
      <div className="bd-box">
        <span className="bd-nameplate">ROBOBUDDY</span>
        <p className="bd-text" aria-label={full}>
          <span aria-hidden="true">{full.slice(0, shown)}</span>
          {/* caret shows only while typing, then disappears — nothing at rest */}
          {shown < full.length && <span className="bd-cursor" aria-hidden="true" />}
        </p>
        {meta && <p className="bd-meta">{meta}</p>}
      </div>
    </div>
  );
}
