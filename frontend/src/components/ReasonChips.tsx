import { useId } from "react";
import type { Item } from "../lib/types";
import * as reactions from "../lib/reactions";

// The Why row at the bottom of an expanded card.
//
// A reaction on its own says how she felt; a chip says which lever the curator
// should pull. The set follows the level, so a card cleared back to none never
// keeps a reason sitting on it.
//
// The entry comes down as a prop rather than being read here, so the card and
// its chips always agree about the level within one render.

export function ReasonChips({ item, entry }: { item: Item; entry: reactions.Entry }) {
  const labelId = useId();
  const ids = reactions.reasonsFor(entry.level);
  if (ids.length === 0) return null;

  return (
    <div className="chips-row">
      <p className="chips-label" id={labelId}>
        Why
      </p>
      <div className="chips" role="group" aria-labelledby={labelId}>
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            className="chip"
            aria-pressed={entry.reasons.includes(id)}
            onClick={() => reactions.toggleReason(item.url, item.section, id)}
          >
            {reactions.REASON_LABELS[id]}
          </button>
        ))}
      </div>
    </div>
  );
}
