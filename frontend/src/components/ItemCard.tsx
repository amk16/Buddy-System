import type { Item, SignalTag } from "../lib/types";

const SIGNAL: Record<SignalTag, { glyph: string; label: string }> = {
  trending: { glyph: "🔥", label: "Trending" },
  new: { glyph: "🆕", label: "New" },
  shift: { glyph: "⚡", label: "Big shift" },
};

export function ItemCard({ item }: { item: Item }) {
  const signal = SIGNAL[item.signal_tag] ?? SIGNAL.new;
  const terms = item.terms?.filter((t) => t.term && t.definition) ?? [];

  return (
    <article className="card">
      <a className="card-headline" href={item.url} target="_blank" rel="noreferrer">
        {item.headline}
      </a>

      {item.summary && <p className="card-summary">{item.summary}</p>}

      <p className="card-why">
        <span className="card-why-label">Why it matters</span> {item.why_it_matters}
      </p>

      {terms.length > 0 && (
        <dl className="card-terms">
          {terms.map((t) => (
            <div className="card-term" key={t.term}>
              <dt>{t.term}</dt>
              <dd>{t.definition}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="card-meta">
        <span className={`tag tag-${item.signal_tag}`}>
          {signal.glyph} {signal.label}
        </span>
        <span className="card-source">
          {item.source_name}
          {item.published_at ? ` · ${item.published_at}` : ""}
        </span>
      </div>
    </article>
  );
}
