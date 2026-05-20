/**
 * Shared SVG glyphs for matchmaking modes.
 *
 * Same gold wireframe vocabulary as the ModePicker cards — reused on the
 * inside-mode hero screens so the brand stays consistent (no raw emojis
 * like 🏁 / 💼 mixed in with the styled iconography).
 *
 *   <ModeGlyph id="code-race" size={44} />              // bare SVG
 *   <ModeBadge id="interview" size={80} />              // SVG inside the gold rounded box
 *   <ModeBadge id="code-race" size={120} faint />       // washed-out decorative version
 */

const STROKE = "#FFD700";
const FILL_SOFT = "rgba(255,215,0,0.15)";

export function ModeGlyph({ id, size = 28 }) {
  const common = { viewBox: "0 0 32 32", width: size, height: size, fill: "none" };
  if (id === "duel-1v1") {
    return (
      <svg {...common}>
        <path d="M6 8 L18 16 L6 24" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 8 L26 16 L14 24" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
      </svg>
    );
  }
  if (id === "code-race") {
    return (
      <svg {...common}>
        <path d="M8 4 L8 28" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M8 6 L24 6 L20 12 L24 18 L8 18 Z" stroke={STROKE} strokeWidth="2.5" fill={FILL_SOFT} strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "interview") {
    return (
      <svg {...common}>
        <rect x="4" y="10" width="24" height="16" rx="2" stroke={STROKE} strokeWidth="2.5" />
        <path d="M12 10 L12 6 L20 6 L20 10" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="4" y1="16" x2="28" y2="16" stroke={STROKE} strokeWidth="2" />
      </svg>
    );
  }
  // practice (default)
  return (
    <svg {...common}>
      <circle cx="16" cy="16" r="12" stroke={STROKE} strokeWidth="2.5" />
      <circle cx="16" cy="16" r="7"  stroke={STROKE} strokeWidth="2" opacity="0.7" />
      <circle cx="16" cy="16" r="2.5" fill={STROKE} />
    </svg>
  );
}

/**
 * Glyph inside the gold rounded-square frame used on mode cards & hero screens.
 *
 *   size       — outer box width/height in px (default 56, matches ModePicker)
 *   isActive   — accent-tinted border/background (only meaningful on cards)
 *   faint      — for decorative background placements (low opacity, no border)
 */
export function ModeBadge({ id, size = 56, isActive = false, faint = false, className = "" }) {
  const glyphSize = Math.round(size * 0.5);
  const borderRadius = Math.round(size * 0.21);
  if (faint) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.08,
        }}
      >
        <ModeGlyph id={id} size={glyphSize} />
      </div>
    );
  }
  return (
    <div
      className={[
        "inline-flex items-center justify-center border",
        isActive ? "border-accent/40 bg-accent/10" : "border-border bg-accent/[0.04]",
        className,
      ].join(" ")}
      style={{ width: size, height: size, borderRadius }}
    >
      <ModeGlyph id={id} size={glyphSize} />
    </div>
  );
}
