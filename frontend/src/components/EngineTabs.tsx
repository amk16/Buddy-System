import type { Engine } from "../lib/types";

// Tab order is fixed (Claude first — the human-reviewed default), independent of
// which engines currently have issues.
export const ENGINE_ORDER: Engine[] = ["claude", "gemini"];

const LABELS: Record<Engine, string> = {
  claude: "Claude",
  gemini: "Gemini",
};

interface Props {
  // Engines that have at least one issue; others render disabled.
  available: Engine[];
  active: Engine;
  onSelect: (engine: Engine) => void;
}

// Segmented pill that filters the archive to one engine at a time. Both segments
// always show so the separation is always legible; an engine with no issues is
// disabled rather than hidden. A quiet utility, sibling to the date dropdown.
export function EngineTabs({ available, active, onSelect }: Props) {
  return (
    <div className="engine-tabs" role="group" aria-label="Source engine">
      {ENGINE_ORDER.map((engine) => {
        const isActive = engine === active;
        const enabled = available.includes(engine);
        return (
          <button
            key={engine}
            type="button"
            className="engine-tab"
            aria-pressed={isActive}
            disabled={!enabled}
            onClick={() => onSelect(engine)}
          >
            {LABELS[engine]}
          </button>
        );
      })}
    </div>
  );
}
