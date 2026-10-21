import type { Item } from "../lib/types";
import * as feedback from "../lib/feedback";

interface Props {
  items: Item[];
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
}

// The 30-second skim: the must-know items at the top of the dashboard.
// Also serves as the bento front door's large tile, unchanged.
export function Brief({ items, headingRef }: Props) {
  if (items.length === 0) return null;

  return (
    <section
      className="brief"
      data-vt="pulse-brief"
      style={{ viewTransitionName: "pulse-brief" }}
    >
      <h2 className="brief-label" tabIndex={-1} ref={headingRef}>
        The Brief
      </h2>
      <p className="brief-sub">If you read nothing else today.</p>
      <ol className="brief-list">
        {items.map((item) => (
          <li key={item.url}>
            {/* one inline-text box per item so the glance can clamp it to three
                lines while the marker stays a list marker */}
            <span className="brief-text">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  feedback.record({ kind: "click", url: item.url, section: item.section })
                }
              >
                {item.headline}
              </a>
              <span className="brief-why"> — {item.why_it_matters}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
