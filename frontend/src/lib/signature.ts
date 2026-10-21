// Per-section signature colours for the bento glance + the fill-screen takeover.
// Three hues reuse the buddy-system signal-tint pairs already in the token
// table; slate blue is the one new pair (verified ≥ 4.5:1 on its tint, on
// paper, and on card). Keep in sync with .claude/skills/buddy-system/SKILL.md.
//
// `accent` is the section's hue: on the glance it appears only on reach (the
// tile's label, sliver and inset edge), in the takeover once, as the dithered
// band and the label's rule (one hue per station, 2026-10-21). `tint` is kept
// as the hue's paper-side value for any future surface; nothing paints it
// today.

export interface Signature {
  /** Edge + label colour. */
  accent: string;
  /** Box surface + takeover background. */
  tint: string;
}

const BY_ID: Record<string, Signature> = {
  tools: { accent: "#6e530e", tint: "#f5ecd6" }, // gold (brand)
  news: { accent: "#8f4524", tint: "#f7e8df" }, // terracotta
  case_studies: { accent: "#1f6e5c", tint: "#e4efe9" }, // green
  people: { accent: "#3a5a78", tint: "#e6edf2" }, // slate blue (new)
};

// Deterministic fallback so an unknown section id still gets a stable colour.
const CYCLE: Signature[] = [
  BY_ID.tools,
  BY_ID.news,
  BY_ID.case_studies,
  BY_ID.people,
];

export function signatureFor(id: string, index: number): Signature {
  return BY_ID[id] ?? CYCLE[index % CYCLE.length];
}
