import { MODES } from "../modes/index.js";

/**
 * ModePicker — arena-style mode grid (Compyra redesign).
 *
 * Large 2×2 cards with brand SVG glyphs, keyboard shortcut chips (1..N),
 * a metric strip, and a gold corner flag for the active mode. Pure black
 * and gold — no other hues.
 *
 * Props match the previous API exactly: { activeId, onSelect, disabled }.
 */
export function ModePicker({ activeId, onSelect, disabled = false }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {MODES.map((mode, idx) => (
        <ModeCard
          key={mode.id}
          mode={mode}
          isActive={mode.id === activeId}
          shortcut={idx + 1}
          disabled={disabled}
          onSelect={() => onSelect(mode.id)}
        />
      ))}
    </div>
  );
}

function ModeCard({ mode, isActive, shortcut, disabled, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={isActive}
      className={[
        "group relative overflow-hidden rounded-card border p-5 text-left transition-all duration-200 transform",
        isActive
          ? "border-accent bg-gradient-to-br from-accent/10 to-accent/[0.03] shadow-glow"
          : "border-border bg-elevated hover:-translate-y-0.5 hover:scale-[1.01] hover:border-accent/40",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      {/* active corner flag */}
      {isActive && (
        <div
          className="absolute left-0 top-0 h-8 w-8 bg-accent"
          style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
        >
          <span className="absolute left-[5px] top-[2px] font-mono text-[10px] font-extrabold text-black">
            ✓
          </span>
        </div>
      )}

      {/* shortcut chip */}
      <div
        className={[
          "absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-md border font-mono text-xs font-bold",
          isActive
            ? "border-accent/60 bg-accent/15 text-accent"
            : "border-border bg-white/[0.02] text-muted",
        ].join(" ")}
      >
        {shortcut}
      </div>

      {/* glyph */}
      <div
        className={[
          "mb-4 flex h-14 w-14 items-center justify-center rounded-xl border",
          isActive ? "border-accent/40 bg-accent/10" : "border-border bg-accent/[0.04]",
        ].join(" ")}
      >
        <ModeGlyph id={mode.id} />
      </div>

      {/* title + blurb */}
      <div className="text-xl font-bold tracking-tight text-foreground">{mode.title}</div>
      <p className="mt-1.5 line-clamp-2 max-w-md text-[13px] leading-snug text-muted">{mode.blurb}</p>

      {/* metric strip */}
      <div className="mt-5 flex items-center gap-6 border-t border-border pt-4">
        <Spec k="ВРЕМЯ" v={timeOf(mode.id)} />
        <Spec k="ИГРОКИ" v={String(mode.partySize ?? 1)} />
        <Spec k="СТАВКА" v={stakeOf(mode.id)} accent={stakeOf(mode.id) !== "без PTS"} />
      </div>
    </button>
  );
}

function Spec({ k, v, accent = false }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-muted">{k}</span>
      <span className={["font-mono text-[13px] font-semibold tracking-tight", accent ? "text-accent" : "text-foreground"].join(" ")}>{v}</span>
    </div>
  );
}

/* ─── Brand glyphs (SVG, не эмодзи) ──────────────────────────────────── */
function ModeGlyph({ id }) {
  const stroke = "#FFD700";
  const fillSoft = "rgba(255,215,0,0.15)";
  if (id === "duel-1v1") {
    return (
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
        <path d="M6 8 L18 16 L6 24" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 8 L26 16 L14 24" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
      </svg>
    );
  }
  if (id === "code-race") {
    return (
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
        <path d="M8 4 L8 28" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M8 6 L24 6 L20 12 L24 18 L8 18 Z" stroke={stroke} strokeWidth="2.5" fill={fillSoft} strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "interview") {
    return (
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
        <rect x="4" y="10" width="24" height="16" rx="2" stroke={stroke} strokeWidth="2.5" />
        <path d="M12 10 L12 6 L20 6 L20 10" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="4" y1="16" x2="28" y2="16" stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }
  // practice (default)
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
      <circle cx="16" cy="16" r="12" stroke={stroke} strokeWidth="2.5" />
      <circle cx="16" cy="16" r="7"  stroke={stroke} strokeWidth="2" opacity="0.7" />
      <circle cx="16" cy="16" r="2.5" fill={stroke} />
    </svg>
  );
}

/* ─── Mock metrics until backend exposes them ───────────────────────── */
function timeOf(id) {
  switch (id) {
    case "duel-1v1":  return "5–8 мин";
    case "code-race": return "10–15 мин";
    case "interview": return "12 мин";
    case "practice":  return "5 мин";
    default:          return "—";
  }
}
function stakeOf(id) {
  switch (id) {
    case "duel-1v1":  return "±50 PTS";
    case "code-race": return "±80 PTS";
    case "interview": return "+30 PTS";
    case "practice":  return "без PTS";
    default:          return "—";
  }
}
