import { useState } from "react";
import type { Issue } from "../lib/types";
import * as lastVisited from "../lib/lastVisited";
import { Brief } from "./Brief";
import { SectionTile } from "./SectionTile";
import { BuddyCorner } from "./BuddyCorner";

interface Props {
  issue: Issue;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onOpenSection: (sectionId: string) => void;
  onOpenFeed: () => void;
}

// The bento front door: Brief first (it IS the large tile), section tiles
// 2-up, then the always-available full feed. The grid never gates content.
export function GlanceGrid({ issue, headingRef, onOpenSection, onOpenFeed }: Props) {
  const [resume, setResume] = useState(() => lastVisited.load(issue.id, issue));
  const resumeLabel = resume
    ? (issue.sections.find((s) => s.id === resume.sectionId)?.label ?? null)
    : null;

  return (
    <div className="glance">
      <h2 className="glance-heading" tabIndex={-1} ref={headingRef}>
        Today at a glance
      </h2>

      <Brief items={issue.brief} />

      {/* Reserved slot: the daily Report tile lands here (full-width, directly
          under the Brief) per docs/superpowers/specs/2026-06-11-daily-report-design.md */}

      {issue.sections.map((section) => (
        <SectionTile key={section.id} section={section} onOpen={onOpenSection} />
      ))}

      <button type="button" className="tile tile-feed" onClick={onOpenFeed}>
        <span className="tile-label">Read everything</span>
        <span className="tile-headline">
          the full feed, every section in one scroll
        </span>
      </button>

      <BuddyCorner
        resume={resume}
        resumeLabel={resumeLabel}
        onResume={(sectionId) => {
          lastVisited.clear();
          onOpenSection(sectionId);
        }}
        onDismiss={() => {
          lastVisited.clear();
          setResume(null);
        }}
      />
    </div>
  );
}
