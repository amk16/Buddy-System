import type { Section as SectionType } from "../lib/types";
import { stripEmoji } from "../lib/strings";
import { ItemCard } from "./ItemCard";

interface Props {
  section: SectionType;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
}

// In the single-section (takeover) view the morphing box is the whole panel,
// which carries the shared pulse-sec-<id> name — the heading no longer does.
export function Section({ section, headingRef }: Props) {
  if (section.items.length === 0) return null;

  return (
    <section className="section">
      <h2 className="section-label" tabIndex={-1} ref={headingRef}>
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
