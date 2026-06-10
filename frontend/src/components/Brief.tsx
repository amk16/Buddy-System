import type { Item } from "../lib/types";

// The 30-second skim: the must-know items at the top of the dashboard.
export function Brief({ items }: { items: Item[] }) {
  if (items.length === 0) return null;

  return (
    <section className="brief">
      <h2 className="brief-label">The Brief</h2>
      <p className="brief-sub">If you read nothing else today.</p>
      <ol className="brief-list">
        {items.map((item) => (
          <li key={item.url}>
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.headline}
            </a>
            <span className="brief-why"> — {item.why_it_matters}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
