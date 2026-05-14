import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { ModePicker } from "../features/matchmaking/components/ModePicker.jsx";
import { DEFAULT_MODE_ID, getModeById } from "../features/matchmaking/modes/index.js";
import { LeaderboardContent } from "./LeaderboardPage.jsx";

/**
 * MatchmakingPage is intentionally a thin shell now.
 *
 * Two top-level tabs: "Игра" (which renders a mode selector + the active
 * mode's UI) and "Рейтинг" (the leaderboard). Everything else — queue,
 * WebSocket, post-match, quests, practice flow — lives inside a mode under
 * `features/matchmaking/modes/<mode-id>/`.
 *
 * To add a new mode: drop a folder under `modes/`, register it in
 * `modes/index.js`. No changes here needed.
 */

const TAB_PARAM = "tab";
const MODE_PARAM = "mode";
const VALID_TABS = new Set(["play", "leaderboard"]);

function resolveTab(value) {
  return VALID_TABS.has(value) ? value : "play";
}

export function MatchmakingPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = resolveTab(searchParams.get(TAB_PARAM));
  const activeModeId = searchParams.get(MODE_PARAM) || DEFAULT_MODE_ID;
  const activeMode = getModeById(activeModeId);

  function switchTab(nextTab) {
    const next = new URLSearchParams(searchParams);
    if (nextTab === "play") {
      next.delete(TAB_PARAM);
    } else {
      next.set(TAB_PARAM, nextTab);
    }
    setSearchParams(next, { replace: true });
  }

  function switchMode(nextModeId) {
    const next = new URLSearchParams(searchParams);
    if (nextModeId === DEFAULT_MODE_ID) {
      next.delete(MODE_PARAM);
    } else {
      next.set(MODE_PARAM, nextModeId);
    }
    setSearchParams(next, { replace: true });
  }

  const ModeComponent = activeMode.Component;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/3 top-20 h-72 w-72 rounded-full bg-accent/[0.05] blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 h-64 w-64 rounded-full bg-accent/[0.04] blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* HEADER */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Арена открыта
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            PvP <span className="text-gradient-accent">Арена</span>
          </h1>
          <p className="mt-3 text-sm text-muted sm:text-base">
            Выбери режим. Брось вызов соперникам или тренируйся в одиночку.
          </p>
        </div>

        {/* TABS */}
        <div className="mx-auto mb-8 flex max-w-sm rounded-btn border border-border bg-elevated/50 p-1">
          <button
            type="button"
            onClick={() => switchTab("play")}
            className={[
              "h-10 flex-1 rounded-[6px] text-sm font-semibold transition-all",
              activeTab === "play"
                ? "bg-accent text-black shadow-glow"
                : "text-muted hover:text-foreground",
            ].join(" ")}
          >
            🎮 Играть
          </button>
          <button
            type="button"
            onClick={() => switchTab("leaderboard")}
            className={[
              "h-10 flex-1 rounded-[6px] text-sm font-semibold transition-all",
              activeTab === "leaderboard"
                ? "bg-accent text-black shadow-glow"
                : "text-muted hover:text-foreground",
            ].join(" ")}
          >
            🏆 Рейтинг
          </button>
        </div>

        {activeTab === "leaderboard" ? (
          <LeaderboardContent embedded />
        ) : (
          <div className="space-y-6">
            <ModePicker activeId={activeMode.id} onSelect={switchMode} />
            <ModeComponent user={user} />
          </div>
        )}
      </div>
    </div>
  );
}
