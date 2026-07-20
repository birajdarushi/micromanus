// MicroManus mascots — original glow-blob "agent spirits", drawn and animated
// entirely in SVG/CSS (no image assets). The body is shared; each state swaps a
// small amber accessory. Animations (float, blink, per-accessory motion) live in
// globals.css under the mm-* keyframes. Crisp at any size and theme-aware.

export type MascotState =
  | "search"
  | "composing"
  | "writing"
  | "thinking"
  | "reading"
  | "code"
  | "globe"
  | "focus"
  | "stats"
  | "frame"
  | "idle"
  | "upload"
  | "download"
  | "share"
  | "lock"
  | "fast"
  | "settings"
  | "layers"
  | "complete"
  | "magic";

const AMBER = "#fbbf24";

function Accessory({ state }: { state: MascotState }) {
  switch (state) {
    case "search":
    case "focus":
      return (
        <g className="mm-bob">
          <circle cx="70" cy="28" r="7.5" fill="none" stroke={AMBER} strokeWidth="3" />
          <line x1="75.5" y1="33.5" x2="83" y2="41" stroke={AMBER} strokeWidth="3.5" strokeLinecap="round" />
        </g>
      );
    case "reading":
      return (
        <g>
          <path d="M30 60 q10 -5 18 0 q8 -5 18 0 l0 10 q-10 -4 -18 0 q-8 -4 -18 0 z" fill={AMBER} opacity="0.9" />
          <line x1="48" y1="60" x2="48" y2="70" stroke="#0c0c10" strokeWidth="1.5" />
        </g>
      );
    case "writing":
    case "magic":
      return (
        <g className="mm-bob">
          <g transform="rotate(42 74 30)">
            <rect x="71" y="14" width="6" height="20" rx="1.5" fill={AMBER} />
            <path d="M71 34 l3 5 l3 -5 z" fill="#0c0c10" />
          </g>
        </g>
      );
    case "lock":
      return (
        <g>
          <path d="M64 30 a8 8 0 0 1 16 0 v5" fill="none" stroke={AMBER} strokeWidth="3.5" />
          <rect x="60" y="33" width="24" height="17" rx="3" fill={AMBER} />
          <circle cx="72" cy="41" r="2.4" fill="#0c0c10" />
        </g>
      );
    case "settings":
      return (
        <g className="mm-spin" style={{ transformOrigin: "72px 30px" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <rect
              key={i}
              x="70.5"
              y="17"
              width="3"
              height="6"
              rx="1"
              fill={AMBER}
              transform={`rotate(${i * 45} 72 30)`}
            />
          ))}
          <circle cx="72" cy="30" r="8.5" fill={AMBER} />
          <circle cx="72" cy="30" r="3.5" fill="#0c0c10" />
        </g>
      );
    case "stats":
      return (
        <g>
          {[
            [62, 34, 12],
            [70, 28, 18],
            [78, 22, 24],
          ].map(([x, y, h], i) => (
            <rect key={i} x={x} y={y} width="5" height={h} rx="1.5" fill={AMBER} className="mm-bar" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </g>
      );
    case "complete":
      return (
        <path d="M62 30 l6 7 l12 -15" fill="none" stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      );
    case "thinking":
    case "composing":
      return (
        <g>
          {[64, 72, 80].map((cx, i) => (
            <circle key={cx} cx={cx} cy="26" r="3.2" fill={AMBER} className="mm-twinkle" style={{ animationDelay: `${i * 0.25}s` }} />
          ))}
        </g>
      );
    case "globe":
    case "share":
      return (
        <g className="mm-spin-slow" style={{ transformOrigin: "72px 30px" }}>
          <circle cx="72" cy="30" r="9" fill="none" stroke={AMBER} strokeWidth="2.5" />
          <ellipse cx="72" cy="30" rx="4" ry="9" fill="none" stroke={AMBER} strokeWidth="2" />
          <line x1="63" y1="30" x2="81" y2="30" stroke={AMBER} strokeWidth="2" />
        </g>
      );
    case "idle":
    default:
      return (
        <g>
          {[
            [74, 22, 5],
            [84, 34, 3.5],
            [66, 32, 3],
          ].map(([cx, cy, r], i) => (
            <g key={i} className="mm-twinkle" style={{ animationDelay: `${i * 0.4}s`, transformOrigin: `${cx}px ${cy}px` }}>
              <path
                d={`M${cx} ${cy - r} L${cx + r * 0.32} ${cy - r * 0.32} L${cx + r} ${cy} L${cx + r * 0.32} ${cy + r * 0.32} L${cx} ${cy + r} L${cx - r * 0.32} ${cy + r * 0.32} L${cx - r} ${cy} L${cx - r * 0.32} ${cy - r * 0.32} Z`}
                fill={AMBER}
              />
            </g>
          ))}
        </g>
      );
  }
}

export default function Mascot({
  state,
  size = 48,
  className = "",
}: {
  state: MascotState;
  size?: number;
  className?: string;
}) {
  const gid = `mm-${state}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className={`mm-mascot select-none ${className}`}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${gid}-glow`} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor={AMBER} stopOpacity="0.5" />
          <stop offset="70%" stopColor={AMBER} stopOpacity="0.08" />
          <stop offset="100%" stopColor={AMBER} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${gid}-body`} cx="42%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#3a3a44" />
          <stop offset="100%" stopColor="#0c0c10" />
        </radialGradient>
      </defs>

      {/* ambient glow */}
      <circle className="mm-glow" cx="48" cy="52" r="40" fill={`url(#${gid}-glow)`} />

      {/* body */}
      <g className="mm-body">
        <ellipse cx="48" cy="54" rx="25" ry="26" fill={`url(#${gid}-body)`} />
        {/* rim light */}
        <path d="M26 46 a24 26 0 0 1 40 -16" fill="none" stroke={AMBER} strokeWidth="2" strokeOpacity="0.45" strokeLinecap="round" />
        {/* eyes */}
        <g className="mm-eyes">
          <rect x="40" y="48" width="5.5" height="13" rx="2.75" fill="#f4f4f5" />
          <rect x="51" y="48" width="5.5" height="13" rx="2.75" fill="#f4f4f5" />
        </g>
      </g>

      <Accessory state={state} />
    </svg>
  );
}
