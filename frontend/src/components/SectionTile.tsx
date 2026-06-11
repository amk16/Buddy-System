import type { Section } from "../lib/types";
import { stripEmoji } from "../lib/strings";

interface Props {
  section: Section;
  onOpen: (sectionId: string) => void;
}

// One bento tile = one button. The preview headline is plain text (the real
// source link lives inside the section view). "…and more inside" is the only
// permitted depth cue — numerals are banned by the buddy-system.
export function SectionTile({ section, onOpen }: Props) {
  const top = section.items[0];
  if (!top) return null;

  return (
    <button
      type="button"
      className="tile"
      style={{ viewTransitionName: `pulse-sec-${section.id}` }}
      onClick={() => onOpen(section.id)}
    >
      <span className="tile-label">{stripEmoji(section.label)}</span>
      <span className="tile-headline">{top.headline}</span>
      {section.items.length > 1 && (
        <span className="tile-more">…and more inside</span>
      )}
    </button>
  );
}
