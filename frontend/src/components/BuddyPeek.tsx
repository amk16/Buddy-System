import { buildPixelFace, hasBuddy, CELL } from "../lib/buddy";

interface Props {
  /** Section id — selects the emotion, palette, and prop. */
  sectionId: string;
  /** The section's signature accent — colours the antenna tip + the prop. */
  accent: string;
}

// The per-section prop the buddy carries (in the section's accent colour):
// wrench (discover) · "!" spark (react) · results chip (results) · heart (connect).
function BuddyProp({ sectionId, accent }: Props) {
  switch (sectionId) {
    case "tools":
      return (
        <g transform="rotate(28 22 104)">
          <rect x={18} y={96} width={6} height={20} rx={3} fill={accent} />
          <path d="M21 92 a7 7 0 1 0 0 9 l0 -4 a3 3 0 1 1 0 -1 z" fill={accent} />
        </g>
      );
    case "news":
      return (
        <g>
          <rect x={98} y={20} width={6} height={14} rx={3} fill={accent} />
          <circle cx={101} cy={40} r={3.4} fill={accent} />
        </g>
      );
    case "case_studies":
      return (
        <g>
          <rect x={6} y={98} width={20} height={14} rx={4} fill={accent} />
          <path
            d="M16 110 l0 -8 M12 106 l4 -4 l4 4"
            stroke="#fffdf6"
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    case "people":
      return (
        <path
          d="M101 98 c-4 -5 -12 -1 -8 5 c2 4 8 7 8 7 c0 0 6 -3 8 -7 c4 -6 -4 -10 -8 -5 z"
          fill={accent}
        />
      );
    default:
      return null;
  }
}

// Decorative inline-SVG mascot that peeks into a tile on hover/focus. Purely
// presentational (aria-hidden via its wrapper); never in the a11y tree.
export function BuddyPeek({ sectionId, accent }: Props) {
  if (!hasBuddy(sectionId)) return null;

  const rects = buildPixelFace(sectionId);
  // Gradient ids are suffixed so four buddies on one page don't collide.
  const cream = `bud-cream-${sectionId}`;
  const sheen = `bud-sheen-${sectionId}`;

  return (
    <svg className="buddy-svg" viewBox="0 0 120 150" focusable="false" aria-hidden="true">
      <defs>
        <linearGradient id={cream} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8f2e5" />
          <stop offset="1" stopColor="#e6dcc5" />
        </linearGradient>
        <radialGradient id={sheen} cx="42%" cy="30%" r="60%">
          <stop offset="0" stopColor="#fffdf6" stopOpacity={0.9} />
          <stop offset="1" stopColor="#fffdf6" stopOpacity={0} />
        </radialGradient>
      </defs>

      <BuddyProp sectionId={sectionId} accent={accent} />

      <g className="buddy-head">
        {/* gripper mitts curling over the rim */}
        <g fill={`url(#${cream})`} stroke="#cabf9f" strokeWidth={1.5}>
          <path d="M16 96 q-9 1 -10 12 q0 6 7 6 q8 0 10 -9 q-3 -1 -3 -5 z" />
          <path d="M104 96 q9 1 10 12 q0 6 -7 6 q-8 0 -10 -9 q3 -1 3 -5 z" />
        </g>
        {/* head + sheen */}
        <ellipse cx={60} cy={58} rx={50} ry={47} fill={`url(#${cream})`} stroke="#cabf9f" strokeWidth={1.8} />
        <ellipse cx={48} cy={38} rx={30} ry={20} fill={`url(#${sheen})`} />
        {/* antenna with accent tip */}
        <path d="M52 13 q-3 -9 1 -13" fill="none" stroke="#b9ad8c" strokeWidth={2.6} strokeLinecap="round" />
        <circle cx={53} cy={0.5} r={4.2} fill={accent} />
        {/* visor brow */}
        <path d="M26 40 q34 -10 68 0" fill="none" stroke="#d6c9ab" strokeWidth={2} />
        {/* screen */}
        <rect x={24} y={42} width={72} height={46} rx={15} fill="#17150f" />
        <rect x={26} y={44} width={68} height={42} rx={13} fill="#0f0d09" />
        {/* pixel face */}
        {rects.map((p, i) => (
          <rect key={i} x={p.x} y={p.y} width={CELL} height={CELL} rx={1} fill={p.fill} />
        ))}
      </g>
    </svg>
  );
}
