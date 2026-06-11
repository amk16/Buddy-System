import type { Section as SectionType } from "../lib/types";
import { stripEmoji } from "../lib/strings";
import { ItemCard } from "./ItemCard";

interface Props {
  section: SectionType;
  // Set only in the single-section view so the tile morphs into this heading.
  // Feed view passes none — glance↔feed cross-fades instead of five morphs.
  vtName?: string;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
}

export function Section({ section, vtName, headingRef }: Props) {
  if (section.items.length === 0) return null;

  return (
    <section className="section">
      <h2
        className="section-label"
        tabIndex={-1}
        ref={headingRef}
        style={vtName ? { viewTransitionName: vtName } : undefined}
      >
        {stripEmoji(section.label)}
      </h2>
      <div className="section-items">
        {section.items.map((item) => (
          <ItemCard key={item.url} item={item} />
        ))}
      </div>
    </section>
  );
}
