import { useId, useState, useSyncExternalStore } from "react";
import type { Item, SignalTag } from "../lib/types";
import * as feedback from "../lib/feedback";
import * as reactions from "../lib/reactions";
import { ReactionMarks } from "./ReactionMarks";
import { ReasonChips } from "./ReasonChips";

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
  // The store is read here too, so the card and its chips agree about the level
  // inside a single render, and a restored level is right on the first paint.
  const entry = useSyncExternalStore(reactions.subscribe, () =>
    reactions.getEntry(item.url),
  );
  const hasDetail = Boolean(item.summary) || terms.length > 0;
  // Amendment to "no summary and no terms renders no toggle": a reaction opens
  // the Why row, and chips are content worth a toggle.
  const showDetail = hasDetail || entry.level !== "none";

  // A bare card whose only content was its Why row loses the panel when the
  // mark is cleared. Forget that it was open, or marking the card again would
  // bring the panel back already expanded, which no card is allowed to do.
  const [wasShown, setWasShown] = useState(showDetail);
  if (wasShown !== showDetail) {
    setWasShown(showDetail);
    if (!showDetail) setOpen(false);
  }

  return (
    <article className="card">
      <span className={`card-kicker tag-${item.signal_tag}`}>
        {SIGNAL[item.signal_tag] ?? SIGNAL.new}
      </span>

      <a
        className="card-headline"
        href={item.url}
        target="_blank"
        rel="noreferrer"
        onClick={() =>
          feedback.record({ kind: "click", url: item.url, section: item.section })
        }
      >
        {item.headline}
      </a>

      <p className="card-why">{item.why_it_matters}</p>

      <div className="card-meta">
        <span className="card-source">
          {item.source_name}
          {item.published_at && (
            <span className="card-date"> · {formatDay(item.published_at)}</span>
          )}
        </span>
        <div className="card-actions">
          <ReactionMarks item={item} />
          {showDetail && (
            <button
              type="button"
              className="card-toggle"
              aria-expanded={open}
              aria-controls={detailId}
              onClick={() => {
                // Expanding is the silent "she looked closer" signal. Repeats
                // are dropped in the lib, so this can fire on every expand.
                if (!open) {
                  feedback.record({
                    kind: "open",
                    url: item.url,
                    section: item.section,
                  });
                }
                setOpen((o) => !o);
              }}
            >
              {open ? "Hide" : "Details"}
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
      </div>

      {showDetail && (
        <div
          className="card-detail"
          data-open={open}
          id={detailId}
          role="region"
          inert={!open}
        >
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
            <ReasonChips item={item} entry={entry} />
          </div>
        </div>
      )}
    </article>
  );
}
