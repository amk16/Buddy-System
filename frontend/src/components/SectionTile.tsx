import type { CSSProperties } from "react";
import type { Section } from "../lib/types";
import type { Signature } from "../lib/signature";
import { stripEmoji } from "../lib/strings";
import { BuddyPeek } from "./BuddyPeek";

interface Props {
  section: Section;
  signature: Signature;
  // Wide boxes span the full bento width (the hero, plus a trailing odd box).
  wide: boolean;
  onOpen: (sectionId: string) => void;
}

// One bento tile = one button, carrying its section's signature colour as
// --sig (edge + label) and --sig-bg (surface). The preview headline is plain
// text (the real source link lives inside the takeover). "…and more inside"
// is the only permitted depth cue — numerals are banned by the buddy-system.
export function SectionTile({ section, signature, wide, onOpen }: Props) {
  const top = section.items[0];
  if (!top) return null;

  const style = {
    viewTransitionName: `pulse-sec-${section.id}`,
    "--sig": signature.accent,
    "--sig-bg": signature.tint,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`tile tile-sig${wide ? " tile-wide" : ""}`}
      style={style}
      data-vt={`pulse-sec-${section.id}`}
      onClick={() => onOpen(section.id)}
    >
      <span className="tile-label">{stripEmoji(section.label)}</span>
      <span className="tile-headline">{top.headline}</span>
      {section.items.length > 1 && (
        <span className="tile-more">…and more inside</span>
      )}
      <span className="tile-buddy" aria-hidden="true">
        <BuddyPeek sectionId={section.id} accent={signature.accent} />
      </span>
    </button>
  );
}
