import type { Section as SectionType } from "../lib/types";
import { ItemCard } from "./ItemCard";

// JSON labels carry a leading emoji for other surfaces; the calm editorial
// layout anchors sections with a terracotta rule instead.
function stripEmoji(label: string): string {
  return label.replace(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*/u, "");
}

export function Section({ section }: { section: SectionType }) {
  if (section.items.length === 0) return null;

  return (
    <section className="section">
      <h2 className="section-label">{stripEmoji(section.label)}</h2>
      <div className="section-items">
        {section.items.map((item) => (
          <ItemCard key={item.url} item={item} />
        ))}
      </div>
    </section>
  );
}
