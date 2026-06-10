import type { Section as SectionType } from "../lib/types";
import { ItemCard } from "./ItemCard";

export function Section({ section }: { section: SectionType }) {
  if (section.items.length === 0) return null;

  return (
    <section className="section">
      <h2 className="section-label">{section.label}</h2>
      <div className="section-items">
        {section.items.map((item) => (
          <ItemCard key={item.url} item={item} />
        ))}
      </div>
    </section>
  );
}
