import { useLayoutEffect, useRef, useState } from "react";
import type { Issue } from "../lib/types";
import * as lastVisited from "../lib/lastVisited";
import { signatureFor } from "../lib/signature";
import { captureGlanceGeometry } from "../lib/glanceGeometry";
import { Brief } from "./Brief";
import { SectionTile } from "./SectionTile";
import { BuddyCorner } from "./BuddyCorner";

interface Props {
  issue: Issue;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onOpenSection: (sectionId: string) => void;
  onOpenFeed: () => void;
}

// A section box spans the full bento width when it's the hero (first) or a
// trailing odd box that would otherwise sit alone in a 2-up row.
function isWide(index: number, count: number): boolean {
  if (index === 0) return true;
  const nonHero = count - 1; // boxes after the hero pair up 2-up
  return nonHero % 2 === 1 && index === count - 1;
}

// The bento front door: Brief tall on the left (always-open, never gated),
// an asymmetric wall of signature-coloured section boxes on the right, then
// the always-available full feed. The grid never gates content.
export function GlanceGrid({ issue, headingRef, onOpenSection, onOpenFeed }: Props) {
  const [resume, setResume] = useState(() => lastVisited.load(issue.id, issue));
  const resumeLabel = resume
    ? (issue.sections.find((s) => s.id === resume.sectionId)?.label ?? null)
    : null;

  const count = issue.sections.length;

  // Cache the bento's live geometry so the section morph can aim each box's
  // collapse/expand at the area center. Re-capture on resize and issue change.
  const glanceRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = glanceRef.current;
    if (!el) return;
    const capture = () => captureGlanceGeometry(el);
    capture();
    const ro = new ResizeObserver(capture);
    ro.observe(el);
    return () => ro.disconnect();
  }, [issue]);

  return (
    <div className="glance" ref={glanceRef}>
      <h2
        className="glance-heading"
        tabIndex={-1}
        ref={headingRef}
        data-vt="pulse-glance-heading"
        style={{ viewTransitionName: "pulse-glance-heading" }}
      >
        At a glance
      </h2>

      <Brief items={issue.brief} />

      {/* Reserved slot: the daily Report tile lands here per
          docs/superpowers/specs/2026-06-11-daily-report-design.md */}

      <div className="glance-bento">
        {issue.sections.map((section, i) => (
          <SectionTile
            key={section.id}
            section={section}
            signature={signatureFor(section.id, i)}
            wide={isWide(i, count)}
            onOpen={onOpenSection}
          />
        ))}

        <button
          type="button"
          className="tile tile-feed"
          onClick={onOpenFeed}
          data-vt="pulse-feed-bar"
          style={{ viewTransitionName: "pulse-feed-bar" }}
        >
          <span className="tile-label">Read everything</span>
          <span className="tile-headline">
            the full feed, every section in one scroll
          </span>
        </button>
      </div>

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
