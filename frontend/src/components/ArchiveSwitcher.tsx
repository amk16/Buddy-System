import type { IndexEntry } from "../lib/types";

interface Props {
  entries: IndexEntry[];
  currentId: string;
  onSelect: (id: string) => void;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ArchiveSwitcher({ entries, currentId, onSelect }: Props) {
  // Hidden only when an engine has no issues at all. A single-issue engine still
  // shows the dropdown (one dated option) so the control cluster stays symmetric
  // across the Claude / Gemini tabs — an empty corner would read as a bug.
  if (entries.length === 0) return null;

  return (
    <div className="archive">
      <label htmlFor="archive-select">Issue</label>
      <select
        id="archive-select"
        value={currentId}
        onChange={(e) => onSelect(e.target.value)}
      >
        {entries.map((entry, idx) => (
          <option key={entry.id} value={entry.id}>
            {formatDate(entry.generated_at)}
            {idx === 0 ? " (latest)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
