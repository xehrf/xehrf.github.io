import { MODES } from "../modes/index.js";

/**
 * Horizontal list of matchmaking modes shown above the active mode's
 * render. Compact pill-card hybrid: icon, title, one-line blurb, and an
 * outline that lights up when active.
 *
 * Receives `activeId` + `onSelect` from MatchmakingPage. The page is also
 * responsible for syncing the choice to the URL via search params so the
 * tab state survives reloads.
 */
export function ModePicker({ activeId, onSelect, disabled = false }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {MODES.map((mode) => {
        const isActive = mode.id === activeId;
        return (
          <button
            key={mode.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(mode.id)}
            className={`group flex items-start gap-3 rounded-card border p-4 text-left transition-all ${
              isActive
                ? "border-accent/60 bg-accent/5 shadow-glow"
                : "border-border bg-elevated/40 hover:border-accent/30 hover:bg-elevated/60"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-btn text-xl ${
                isActive ? "bg-accent/15 text-accent" : "bg-border/30 text-foreground/80"
              }`}
            >
              {mode.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-bold ${isActive ? "text-accent" : "text-foreground"}`}>
                  {mode.title}
                </p>
                {isActive ? (
                  <span className="text-[9px] uppercase tracking-wider text-accent">●</span>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted">
                {mode.blurb}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
