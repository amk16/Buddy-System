import type { LastVisited } from "../lib/lastVisited";
import { stripEmoji } from "../lib/strings";

const BASE = import.meta.env.BASE_URL;

interface Props {
  resume: LastVisited | null;
  resumeLabel: string | null; // section label for the resume target
  onResume: (sectionId: string) => void;
  onDismiss: () => void;
}

// RoboBuddy is strictly ambient: a still greeter in the glance grid's last
// cell. It never animates, never blocks, never instructs. The resume chip is
// the only thing it ever offers, and only when there's something to resume.
export function BuddyCorner({ resume, resumeLabel, onResume, onDismiss }: Props) {
  return (
    <div className="buddy-corner">
      {resume && resumeLabel && (
        <span className="resume-chip">
          <button
            type="button"
            className="resume-go"
            onClick={() => onResume(resume.sectionId)}
          >
            Pick up where you left off · {stripEmoji(resumeLabel)}
          </button>
          <button
            type="button"
            className="resume-dismiss"
            aria-label="Dismiss resume suggestion"
            onClick={onDismiss}
          >
            ×
          </button>
        </span>
      )}
      <img
        className="buddy-img"
        src={`${BASE}robobuddy.png`}
        alt=""
        width={64}
        height={64}
      />
    </div>
  );
}
