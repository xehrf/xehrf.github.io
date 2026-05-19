import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { ModePicker } from "../features/matchmaking/components/ModePicker.jsx";
import { DEFAULT_MODE_ID, getModeById, MODES } from "../features/matchmaking/modes/index.js";
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
    if (nextTab === "play") next.delete(TAB_PARAM);
    else next.set(TAB_PARAM, nextTab);
    setSearchParams(next, { replace: true });
  }

  function switchMode(nextModeId) {
    const next = new URLSearchParams(searchParams);
    if (nextModeId === DEFAULT_MODE_ID) next.delete(MODE_PARAM);
    else next.set(MODE_PARAM, nextModeId);
    setSearchParams(next, { replace: true });
  }

  // Keyboard shortcuts 1..N for mode selection
  useEffect(() => {
    function onKey(e) {
      if (activeTab !== "play") return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const idx = parseInt(e.key, 10);
      if (Number.isFinite(idx) && idx >= 1 && idx <= MODES.length) {
        switchMode(MODES[idx - 1].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTab, switchMode]);

  const ModeComponent = activeMode.Component;

  return (
    <div className="relative min-h-screen bg-canvas text-foreground">
      {/* Background gold glows */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[20%] top-20 h-[480px] w-[480px] rounded-full bg-accent/[0.06] blur-3xl" />
        <div className="absolute bottom-[20%] right-[10%] h-[360px] w-[360px] rounded-full bg-accent/[0.05] blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* HERO — arena status */}
        <ArenaStatus user={user} />

        {/* TABS */}
        <div className="mt-8 mx-auto flex max-w-sm rounded-btn border border-border bg-elevated/50 p-1">
          <button
            type="button"
            onClick={() => switchTab("play")}
            className={[
              "h-10 flex-1 rounded-[6px] text-sm font-semibold tracking-tight transition-all duration-200",
              activeTab === "play"
                ? "bg-accent text-black shadow-glow"
                : "text-muted hover:text-foreground",
            ].join(" ")}
          >
            Играть
          </button>
          <button
            type="button"
            onClick={() => switchTab("leaderboard")}
            className={[
              "h-10 flex-1 rounded-[6px] text-sm font-semibold tracking-tight transition-all duration-200",
              activeTab === "leaderboard"
                ? "bg-accent text-black shadow-glow"
                : "text-muted hover:text-foreground",
            ].join(" ")}
          >
            Рейтинг
          </button>
        </div>

        {activeTab === "leaderboard" ? (
          <div className="mt-8">
            <LeaderboardContent embedded />
          </div>
        ) : (
          <div className="mt-10 space-y-10">
            <SectionHeader index="01" title="Выбери режим" hint="Быстро — нажми 1·2·3·4" />
            <ModePicker activeId={activeMode.id} onSelect={switchMode} />

            <SectionHeader
              index="02"
              title={`Войти в арену — ${activeMode.title}`}
              hint={activeMode.blurb}
            />
            <ModeComponent user={user} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Arena status hero ─────────────────────────────────────────────── */

function ArenaStatus({ user }) {
  // Mock live counter — replace with backend data once available
  const [now, setNow] = useState(2847);
  useEffect(() => {
    const t = setInterval(() => {
      setNow((n) => Math.max(2400, n + (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * 4)));
    }, 1400);
    return () => clearInterval(t);
  }, []);

  const pts = user?.pts ?? 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-elevated shadow-card">
      {/* gold radial */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-accent/[0.18] blur-3xl" />
      {/* scanlines */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,215,0,0.4) 2px 3px)",
        }}
      />

      <div className="relative px-6 py-8 sm:px-10 sm:py-9">
        {/* live label */}
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
            АРЕНА ОТКРЫТА · СЕЗОН 03
          </span>
        </div>

        <div className="mt-5 grid gap-8 lg:grid-cols-[1.4fr,1fr] lg:items-end">
          {/* headline */}
          <div>
            <h1 className="text-4xl font-bold leading-none tracking-tight text-foreground sm:text-5xl">
              Готов <span className="text-accent">доказать?</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              Выбери режим. Победил — забираешь PTS соперника. Проиграл — теряешь
              и идёшь готовиться. В первые 5 матчей идёт калибровка — они не влияют
              на основной рейтинг.
            </p>
          </div>

          {/* stats */}
          <div className="grid grid-cols-2 gap-2.5">
            <StatCell label="ИГРАЮТ СЕЙЧАС" value={now.toLocaleString("ru-RU")} footer="за последнюю минуту" pulse />
            <StatCell label="СРЕДНЕЕ ОЖИДАНИЕ" value="0:08" footer="по твоему PTS" />
            <StatCell label="ТВОЙ PTS" value={pts.toLocaleString("ru-RU")} footer="↑ держи серию" big />
            <StatCell label="КАЛИБРОВКА" value="5/5" footer="завершена" big />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, footer, big = false, pulse = false }) {
  return (
    <div className="relative rounded-xl border border-border bg-canvas/60 px-4 py-3">
      <div className="flex items-center gap-2">
        {pulse && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
        )}
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-muted">{label}</span>
      </div>
      <div
        className={[
          "mt-1.5 font-mono font-bold tabular-nums leading-none tracking-tight text-accent",
          big ? "text-3xl" : "text-2xl",
        ].join(" ")}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11px] text-muted">{footer}</div>
    </div>
  );
}

/* ─── Section header ────────────────────────────────────────────────── */

function SectionHeader({ index, title, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">{index}</span>
        <span className="h-px flex-1 bg-border" />
        {hint && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{hint.length > 60 ? hint.slice(0, 60) + "…" : hint}</span>
        )}
      </div>
      <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h2>
    </div>
  );
}
