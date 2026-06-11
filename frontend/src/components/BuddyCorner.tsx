import type { LastVisited } from "../lib/lastVisited";
import { stripEmoji } from "../lib/strings";

interface Props {
  resume: LastVisited | null;
  resumeLabel: string | null; // section label for the resume target
  onResume: (sectionId: string) => void;
  onDismiss: () => void;
}

// RoboBuddy itself lives in the masthead; this corner is only his one offer —
// the optional "pick up where you left off" chip. It never blocks, never
// instructs, and disappears once used or dismissed.
export function BuddyCorner({ resume, resumeLabel, onResume, onDismiss }: Props) {
  if (!resume || !resumeLabel) return null;

  return (
    <div className="buddy-corner">
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
    </div>
  );
}
