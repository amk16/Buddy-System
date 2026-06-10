import { useId, useState } from "react";
import type { Item, SignalTag } from "../lib/types";

const SIGNAL: Record<SignalTag, string> = {
  trending: "Trending",
  new: "New",
  shift: "Big shift",
};

// "2026-06-09" → "Jun 9". Built via the local-time constructor so negative
// UTC offsets don't shift the day; anything unparseable passes through.
function formatDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Calm by default: collapsed cards show only kicker, headline, why-it-matters
// and meta. The summary + glossary unfold behind a quiet "Details" button.
export function ItemCard({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const terms = item.terms?.filter((t) => t.term && t.definition) ?? [];
  const hasDetail = Boolean(item.summary) || terms.length > 0;

  return (
    <article className="card">
      <span className={`card-kicker tag-${item.signal_tag}`}>
        {SIGNAL[item.signal_tag] ?? SIGNAL.new}
      </span>

      <a className="card-headline" href={item.url} target="_blank" rel="noreferrer">
        {item.headline}
      </a>

      <p className="card-why">{item.why_it_matters}</p>

      <div className="card-meta">
        <span className="card-source">
          {item.source_name}
          {item.published_at ? ` · ${formatDay(item.published_at)}` : ""}
        </span>
        {hasDetail && (
          <button
            type="button"
            className="card-toggle"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Less" : "Details"}
            <svg
              className="chev"
              aria-hidden="true"
              width="12"
              height="8"
              viewBox="0 0 12 8"
            >
              <path
                d="M1 1.5 6 6.5 11 1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {hasDetail && (
        <div className="card-detail" data-open={open} id={detailId} role="region">
          <div className="card-detail-inner">
            {item.summary && <p className="card-summary">{item.summary}</p>}
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
          </div>
        </div>
      )}
    </article>
  );
}
