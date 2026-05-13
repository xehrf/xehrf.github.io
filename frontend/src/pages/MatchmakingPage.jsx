import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, getWebSocketBaseUrl } from "../api/client.js";
import { useAuth } from "../auth/AuthProvider.jsx";
import { MatchArena } from "../features/matchmaking/components/MatchArena.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Button, LinkButton } from "../components/ui/Button.jsx";
import { LeaderboardContent } from "./LeaderboardPage.jsx";

const PARTY_SIZE = 2;

function logDevError(scope, error) {
  if (import.meta.env.DEV) {
    console.error(`[MatchmakingPage] ${scope}`, error);
  }
}

function getMatchmakingSocketUrl(token) {
  const wsOrigin = getWebSocketBaseUrl();
  return `${wsOrigin}/matchmaking/ws?token=${encodeURIComponent(token)}`;
}

function normalizeUserId(userId) {
  if (userId == null) return null;
  return String(userId);
}

function isSameUserId(left, right) {
  const normalizedLeft = normalizeUserId(left);
  return normalizedLeft !== null && normalizedLeft === normalizeUserId(right);
}

function translateQuestTitle(title) {
  if (!title) return "";
  const playMatch = title.match(/^Play\s+(\d+)\s+PvP\s+matches$/i);
  if (playMatch) {
    const count = Number(playMatch[1]);
    return `Сыграйте ${count} PvP матч${count === 1 ? "" : count >= 2 && count <= 4 ? "а" : "ей"}`;
  }
  const winMatch = title.match(/^Win\s+(\d+)\s+PvP\s+matches$/i);
  if (winMatch) {
    const count = Number(winMatch[1]);
    return `Выиграйте ${count} PvP матч${count === 1 ? "" : count >= 2 && count <= 4 ? "а" : "ей"}`;
  }
  return title;
}

// ============================================================
// RADAR — поисковая анимация (концентрические кольца)
// ============================================================
function SearchRadar({ state, queueSize, queuePosition }) {
  // state: "idle" | "searching" | "matched"
  const isSearching = state === "searching";
  const isMatched = state === "matched";
  const slotsFilled = Math.min(queueSize, PARTY_SIZE);

  return (
    <div className="relative mx-auto flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
      {/* Внешние кольца */}
      <div
        className={`absolute inset-0 rounded-full border-2 border-accent/20 ${
          isSearching ? "animate-ping" : ""
        }`}
      />
      <div
        className={`absolute inset-4 rounded-full border border-accent/15 ${
          isSearching ? "animate-pulse" : ""
        }`}
        style={{ animationDelay: "0.5s" }}
      />
      <div
        className={`absolute inset-8 rounded-full border border-accent/10 ${
          isSearching ? "animate-pulse" : ""
        }`}
        style={{ animationDelay: "1s" }}
      />

      {/* Вращающийся луч (только при поиске) */}
      {isSearching && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, rgba(255,215,0,0.18) 60deg, transparent 90deg)",
            animation: "spin 2.5s linear infinite",
          }}
        />
      )}

      {/* Центральный круг */}
      <div
        className={`relative z-10 flex h-32 w-32 flex-col items-center justify-center rounded-full border-2 transition-all sm:h-36 sm:w-36 ${
          isMatched
            ? "border-accent bg-accent/20 shadow-glow"
            : isSearching
              ? "border-accent/60 bg-canvas shadow-glow"
              : "border-border bg-canvas"
        }`}
      >
        {isMatched ? (
          <>
            <div className="text-4xl">⚔</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-accent">
              МАТЧ
            </div>
          </>
        ) : isSearching ? (
          <>
            <div className="font-mono text-3xl font-bold text-accent">
              {slotsFilled}
              <span className="text-muted">/{PARTY_SIZE}</span>
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted">
              {queuePosition ? `позиция #${queuePosition}` : "в очереди"}
            </div>
          </>
        ) : (
          <>
            <div className="text-4xl">🎯</div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted">
              готов
            </div>
          </>
        )}
      </div>

      {/* Точки на кольцах */}
      {[0, 90, 180, 270].map((deg, i) => (
        <div
          key={i}
          className={`absolute h-2 w-2 rounded-full ${
            isSearching ? "bg-accent" : "bg-border"
          } ${isSearching ? "animate-pulse" : ""}`}
          style={{
            transform: `rotate(${deg}deg) translate(7.5rem) rotate(-${deg}deg)`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================
// STREAK FLAME — горящая серия побед
// ============================================================
function StreakIndicator({ current, best }) {
  if (current == null) return null;
  const isHot = current >= 3;
  const isLegendary = current >= 7;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Серия побед
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-3xl font-bold ${
                isHot ? "text-accent" : "text-foreground"
              }`}
            >
              {current}
            </span>
            <span className="text-xs text-muted">подряд</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Рекорд: <span className="text-foreground">{best}</span>
          </p>
        </div>
        <div className="text-4xl">
          {isLegendary ? "🔥🔥🔥" : isHot ? "🔥" : "💤"}
        </div>
      </div>
      {isHot && (
        <div className="mt-3 rounded-btn border border-accent/30 bg-accent/5 px-3 py-2 text-[11px] leading-snug text-accent">
          {isLegendary
            ? "Легендарная серия! Каждая победа = +50% PTS"
            : "В огне! +25% PTS за каждую победу"}
        </div>
      )}
    </Card>
  );
}

// ============================================================
// QUEST CARD
// ============================================================
function QuestRow({ quest, sectionId, onClaim, isClaiming }) {
  const target = Math.max(1, Number(quest.target ?? 1));
  const progress = Math.max(0, Number(quest.progress ?? 0));
  const pct = Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
  const completed = quest.completed;
  const claimed = quest.claimed;

  return (
    <div
      className={`rounded-btn border p-3 transition-colors ${
        claimed
          ? "border-border/40 bg-elevated/30 opacity-60"
          : completed
            ? "border-accent/40 bg-accent/5"
            : "border-border bg-elevated"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {translateQuestTitle(quest.title)}
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted">
            {progress}/{target} · +{quest.reward_pts} PTS
          </p>
        </div>
        {completed && !claimed ? (
          <Button
            onClick={() => onClaim(sectionId, quest.id)}
            disabled={isClaiming}
            className="h-8 px-3 text-xs"
          >
            {isClaiming ? "..." : "Забрать"}
          </Button>
        ) : (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
              claimed
                ? "bg-border/30 text-muted"
                : "border border-border text-muted"
            }`}
          >
            {claimed ? "✓ Готово" : completed ? "Готов" : "В пути"}
          </span>
        )}
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/40">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            completed ? "bg-accent" : "bg-accent/60"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function QuestsCard({ quests, onClaim, claimingQuestKey }) {
  if (!quests) return null;

  const sections = [
    { id: "daily", title: "Ежедневные", icon: "☀", data: quests.daily },
    { id: "weekly", title: "Недельные", icon: "📅", data: quests.weekly },
  ];

  return (
    <Card className="p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
        Квесты
      </h3>
      <div className="mt-3 space-y-4">
        {sections.map((section) => (
          <div key={section.id}>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-accent">
              <span>{section.icon}</span>
              <span className="uppercase tracking-wider">{section.title}</span>
            </div>
            <div className="space-y-2">
              {(section.data?.quests || []).map((quest) => (
                <QuestRow
                  key={`${section.id}:${quest.id}`}
                  quest={quest}
                  sectionId={section.id}
                  onClaim={onClaim}
                  isClaiming={claimingQuestKey === `${section.id}:${quest.id}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// SURRENDER MODAL
// ============================================================
function SurrenderConfirmModal({ open, loading, error, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 px-4 py-8 backdrop-blur-sm">
      <Card
        className="w-full max-w-md p-6 sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="surrender-modal-title"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/80">
          Подтверждение
        </p>
        <h2
          id="surrender-modal-title"
          className="mt-2 text-2xl font-bold text-foreground"
        >
          Сдаться и потерять PTS?
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Матч завершится поражением, рейтинг уменьшится. Если это случайный
          клик — лучше продолжай.
        </p>

        {error ? (
          <div className="mt-4 rounded-btn border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
            className="h-11 px-4"
          >
            Отмена
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center rounded-btn bg-red-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Сдаёмся..." : "Сдаться"}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// СТАТУС МАТЧЕЙ ЗА СЕГОДНЯ (моковая статистика)
// ============================================================
function ArenaStats() {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-btn border border-border bg-elevated/50 px-2 py-2.5">
        <div className="font-mono text-lg font-bold text-accent">247</div>
        <div className="text-[10px] uppercase tracking-wider text-muted">
          матчей сегодня
        </div>
      </div>
      <div className="rounded-btn border border-border bg-elevated/50 px-2 py-2.5">
        <div className="font-mono text-lg font-bold text-accent">~25s</div>
        <div className="text-[10px] uppercase tracking-wider text-muted">
          среднее ожидание
        </div>
      </div>
      <div className="rounded-btn border border-border bg-elevated/50 px-2 py-2.5">
        <div className="font-mono text-lg font-bold text-accent">±150</div>
        <div className="text-[10px] uppercase tracking-wider text-muted">
          PTS разброс
        </div>
      </div>
    </div>
  );
}

// ============================================================
// POST-MATCH SCREEN — экран результатов после боя
// ============================================================
function PostMatchScreen({ result, myUserId, opponentSnapshot, onRematch, onNewMatch, rematchLoading }) {
  const iWon = result?.winner_user_id != null && isSameUserId(result.winner_user_id, myUserId);
  const isDraw = !result?.winner_user_id;

  const myPtsDelta = iWon
    ? Number(result?.winner_pts_delta ?? 0)
    : isDraw
      ? 0
      : Number(result?.loser_pts_delta ?? 0);

  const streak = iWon ? Number(result?.winner_streak ?? 0) : 0;
  const streakBonus = iWon ? Number(result?.winner_streak_bonus ?? 0) : 0;

  const REASON_MAP = {
    surrender: iWon ? "Соперник сдался" : "Вы сдались",
    timeout: "Время вышло",
    timeout_draw: "Ничья по времени",
  };
  const reasonText = REASON_MAP[result?.reason] ?? (iWon ? "Решение принято первым" : "Соперник решил быстрее");

  const opponentName =
    opponentSnapshot?.display_name ?? opponentSnapshot?.nickname ?? opponentSnapshot?.name ?? "Соперник";
  const opponentPts = opponentSnapshot?.pts ?? null;
  const oppInitial = opponentName[0]?.toUpperCase() ?? "?";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* Result banner */}
      <div
        className="rounded-3xl border p-8 text-center"
        style={{
          borderColor: iWon
            ? "rgba(255,214,0,0.4)"
            : isDraw
              ? "rgba(255,255,255,0.15)"
              : "rgba(239,68,68,0.3)",
          background: iWon
            ? "rgba(255,214,0,0.07)"
            : isDraw
              ? "rgba(255,255,255,0.03)"
              : "rgba(239,68,68,0.05)",
        }}
      >
        <div className="text-5xl">{iWon ? "🏆" : isDraw ? "🤝" : "💀"}</div>
        <h2
          className="mt-3 text-3xl font-bold tracking-tight"
          style={{
            color: iWon ? "#FFD600" : isDraw ? "#E6EDF3" : "#f87171",
            textShadow: iWon ? "0 0 32px rgba(255,214,0,0.4)" : "none",
          }}
        >
          {iWon ? "ПОБЕДА" : isDraw ? "НИЧЬЯ" : "ПОРАЖЕНИЕ"}
        </h2>
        <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          {reasonText}
        </p>

        <div className="mt-6 flex items-center justify-center gap-8">
          <div>
            <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
              Изменение PTS
            </p>
            <p
              className="mt-1 font-mono text-4xl font-bold"
              style={{ color: myPtsDelta >= 0 ? "#22c55e" : "#f87171" }}
            >
              {myPtsDelta >= 0 ? "+" : ""}
              {myPtsDelta}
            </p>
          </div>
          {streak >= 2 && (
            <>
              <div className="h-12 w-px" style={{ background: "rgba(255,255,255,0.1)" }} />
              <div>
                <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Серия побед
                </p>
                <p className="mt-1 text-2xl font-bold text-[#FFD600]">
                  🔥 {streak}
                  {streakBonus > 0 && <span className="ml-1 text-lg text-green-400">+{streakBonus}</span>}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Opponent card */}
      {opponentSnapshot && (
        <div
          className="flex items-center gap-4 rounded-2xl border p-4"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "#111" }}
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold"
            style={{ background: "rgba(255,214,0,0.12)", color: "#FFD600" }}
          >
            {oppInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
              Соперник
            </p>
            <p className="truncate font-semibold text-white">{opponentName}</p>
            {opponentPts != null && (
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                {opponentPts} PTS
              </p>
            )}
          </div>
          <div className="text-2xl">{iWon ? "😞" : isDraw ? "🤝" : "😎"}</div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {result?.match_id && (
          <button
            type="button"
            onClick={onRematch}
            disabled={rematchLoading}
            className="h-12 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{ background: "#FFD600", color: "#111" }}
          >
            {rematchLoading ? "Запускаем..." : "⚡ Реванш"}
          </button>
        )}
        <button
          type="button"
          onClick={onNewMatch}
          className="h-12 rounded-xl border text-sm font-medium text-white/80 transition-colors hover:text-white"
          style={{ borderColor: "rgba(255,214,0,0.2)", background: "transparent" }}
        >
          Найти нового соперника
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export function MatchmakingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "leaderboard" ? "leaderboard" : "duel";
  const myUserId = user?.id ?? null;
  const [activeMatch, setActiveMatch] = useState(null);
  const activeMatchRef = useRef(null);
  const [opponentSnapshot, setOpponentSnapshot] = useState(null);
  const [queueInfo, setQueueInfo] = useState({
    queue_size: 0,
    queue_position: null,
    total: PARTY_SIZE,
  });
  const [searching, setSearching] = useState(false);
  const [statusNote, setStatusNote] = useState(
    "Нажми «Найти матч» — алгоритм подберёт соперника твоего уровня."
  );
  const [error, setError] = useState("");
  const [teamCurrent, setTeamCurrent] = useState(null);
  const [quests, setQuests] = useState(null);
  const [claimingQuestKey, setClaimingQuestKey] = useState("");
  const [lastMatchResult, setLastMatchResult] = useState(null);
  const [rematchLoading, setRematchLoading] = useState(false);
  const [surrendering, setSurrendering] = useState(false);
  const [showSurrenderModal, setShowSurrenderModal] = useState(false);
  const [surrenderModalError, setSurrenderModalError] = useState("");

  useEffect(() => {
    activeMatchRef.current = activeMatch;
  }, [activeMatch]);

  const queueState = useMemo(() => {
    if (activeMatch) return "matched";
    if (searching) return "searching";
    return "idle";
  }, [activeMatch, searching]);

  function switchTab(tab) {
    const next = new URLSearchParams(searchParams);
    if (tab === "leaderboard") {
      next.set("tab", "leaderboard");
    } else {
      next.delete("tab");
    }
    setSearchParams(next, { replace: true });
  }

  const loadQuests = useCallback(async () => {
    try {
      const payload = await apiFetch("/matchmaking/quests");
      setQuests(payload);
    } catch (eventError) {
      logDevError("Failed to load quests.", eventError);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const current = await apiFetch("/matchmaking/active");
        if (!mounted) return;
        if (current) {
          setActiveMatch(current);
          setSearching(false);
          setStatusNote("Активная дуэль восстановлена.");
        }
      } catch (eventError) {
        logDevError("Failed to restore active match.", eventError);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [myUserId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const currentTeam = await apiFetch("/teams/current");
        if (mounted) setTeamCurrent(currentTeam);
      } catch (eventError) {
        logDevError("Failed to load current team.", eventError);
        setTeamCurrent(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    loadQuests();
  }, [loadQuests]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return undefined;

    const ws = new WebSocket(getMatchmakingSocketUrl(token));
    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      const data = payload.data ?? {};

      if (payload.event === "queue_update") {
        setQueueInfo({
          queue_size: data.queue_size ?? 0,
          queue_position: data.queue_position ?? null,
          total: data.total ?? PARTY_SIZE,
        });
        setSearching(data.status === "queued");
        if (data.status === "queued") {
          setStatusNote("Ищем соперника с близким PTS...");
        }
      }

      if (payload.event === "match_found" || payload.event === "active_match") {
        setActiveMatch((prev) => ({ ...(prev ?? {}), ...data }));
        setLastMatchResult(null);
        setOpponentSnapshot(null);
        setSearching(false);
        setSurrendering(false);
        setShowSurrenderModal(false);
        setSurrenderModalError("");
        setStatusNote("Соперник найден. Переходим в дуэль.");
        apiFetch("/matchmaking/active")
          .then((current) => {
            if (current) setActiveMatch(current);
          })
          .catch((eventError) => {
            logDevError("Failed to refresh active match after websocket update.", eventError);
          });
      }

      if (payload.event === "match_finished") {
        const cur = activeMatchRef.current;
        const opp =
          cur?.opponent ??
          cur?.participants?.find((p) => !isSameUserId(p?.user_id, myUserId)) ??
          null;
        setOpponentSnapshot(opp);
        setLastMatchResult(data);
        setActiveMatch(null);
        setSearching(false);
        setRematchLoading(false);
        setSurrendering(false);
        setShowSurrenderModal(false);
        setSurrenderModalError("");
        setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });

        const iWon = isSameUserId(data.winner_user_id, myUserId);
        if (iWon) {
          const streak = Number(data.winner_streak ?? 0);
          const bonus = Number(data.winner_streak_bonus ?? 0);
          const streakNote =
            streak >= 2 ? ` Серия: ${streak} (+${bonus} бонус).` : "";
          setStatusNote(
            data.reason === "surrender"
              ? `Соперник сдался. Победа!${streakNote}`
              : `Победа в матче!${streakNote}`
          );
        } else {
          setStatusNote(
            data.reason === "surrender"
              ? "Вы сдались в матче."
              : "Матч завершён. Попробуй реванш."
          );
        }
        loadQuests();
      }

      if (payload.event === "rematch_offered") {
        setLastMatchResult((prev) => ({ ...(prev ?? {}), match_id: data.match_id }));
        setStatusNote("Соперник предлагает реванш. Нажми кнопку «Реванш».");
      }
    });

    return () => {
      ws.close();
    };
  }, [loadQuests, myUserId]);

  useEffect(() => {
    if (activeMatch) return;
    setShowSurrenderModal(false);
    setSurrenderModalError("");
  }, [activeMatch]);

  async function runFindMatch() {
    if (queueState === "searching") return;
    setError("");
    setSearching(true);
    setStatusNote("Подключаем к PvP-очереди...");

    try {
      const result = await apiFetch("/matchmaking/queue", { method: "POST" });
      if (result.status === "matched" || result.status === "already_in_match") {
        setActiveMatch(result);
        setSearching(false);
        setStatusNote("Матч найден.");
        return;
      }
      if (result.status === "queued") {
        setQueueInfo({
          queue_size: result.queue_size ?? 1,
          queue_position: result.queue_position ?? null,
          total: PARTY_SIZE,
        });
        setStatusNote("Вы в очереди. Ожидаем соперника...");
        return;
      }
      setError(result.message || "Ошибка матчмейкинга.");
      setSearching(false);
    } catch (eventError) {
      setError(eventError?.message || "Ошибка матчмейкинга.");
      setSearching(false);
    }
  }

  async function runLeaveQueue() {
    setError("");
    try {
      await apiFetch("/matchmaking/queue", { method: "DELETE" });
    } catch (eventError) {
      logDevError("Failed to leave matchmaking queue.", eventError);
    }
    setActiveMatch(null);
    setSearching(false);
    setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
    setStatusNote("Поиск отменён.");
  }

  function requestSurrender() {
    if (!activeMatch || surrendering) return;
    setError("");
    setSurrenderModalError("");
    setShowSurrenderModal(true);
  }

  async function runSurrender() {
    await confirmSurrenderFromModal();
  }

  async function confirmSurrenderFromModal() {
    if (!activeMatch || surrendering) return;

    const opp =
      activeMatch?.opponent ??
      activeMatch?.participants?.find((p) => !isSameUserId(p?.user_id, myUserId)) ??
      null;
    setOpponentSnapshot(opp);

    setError("");
    setSurrenderModalError("");
    setSurrendering(true);

    try {
      const payload = await apiFetch("/matchmaking/surrender", { method: "POST" });
      setLastMatchResult(payload);
      setActiveMatch(null);
      setSearching(false);
      setShowSurrenderModal(false);
      setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
      await loadQuests();
      setStatusNote("Вы сдались в матче. PTS были уменьшены.");
    } catch (eventError) {
      const message = eventError?.message || "";
      const alreadyFinished =
        eventError?.status === 409 ||
        message.includes("Match is already finished") ||
        message.includes("No active match to surrender");
      if (alreadyFinished) {
        setActiveMatch(null);
        setSearching(false);
        setShowSurrenderModal(false);
        setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
        setStatusNote("Матч уже завершён.");
        await loadQuests();
      } else {
        setError(message);
        setSurrenderModalError(message || "Не удалось сдаться.");
      }
    }
    setSurrendering(false);
  }

  async function handleClaimQuest(period, questId) {
    const key = `${period}:${questId}`;
    setClaimingQuestKey(key);
    setError("");
    try {
      const reward = await apiFetch(
        `/matchmaking/quests/${period}/${questId}/claim`,
        { method: "POST" }
      );
      setStatusNote(`Квест завершён: +${reward.reward_pts ?? 0} PTS`);
      await loadQuests();
    } catch (eventError) {
      setError(eventError?.message || "Не удалось забрать награду за квест.");
    } finally {
      setClaimingQuestKey("");
    }
  }

  async function handleRematch() {
    if (!lastMatchResult?.match_id || rematchLoading) return;
    setRematchLoading(true);
    setError("");
    try {
      const result = await apiFetch("/matchmaking/rematch", {
        method: "POST",
        body: { match_id: lastMatchResult.match_id },
      });
      if (result.status === "matched" || result.status === "already_in_match") {
        setActiveMatch(result);
        setSearching(false);
        setLastMatchResult(null);
        setOpponentSnapshot(null);
        setStatusNote("Реванш начинается!");
        return;
      }
      setStatusNote(
        result.status === "waiting_rematch"
          ? "Реванш предложен. Ждём подтверждение."
          : result.message || "Ожидаем подтверждение реванша."
      );
    } catch (eventError) {
      setError(eventError?.message || "Не удалось запустить реванш.");
    } finally {
      setRematchLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Декоративный фон */}
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
            PvP <span className="text-gradient-accent">Дуэль</span> 1v1
          </h1>
          <p className="mt-3 text-sm text-muted sm:text-base">
            Один противник. Одна задача. 30 минут на победу.
          </p>
        </div>

        {/* TABS */}
        <div className="mx-auto mb-8 flex max-w-sm rounded-btn border border-border bg-elevated/50 p-1">
          <button
            type="button"
            onClick={() => switchTab("duel")}
            className={[
              "h-10 flex-1 rounded-[6px] text-sm font-semibold transition-all",
              activeTab === "duel"
                ? "bg-accent text-black shadow-glow"
                : "text-muted hover:text-foreground",
            ].join(" ")}
          >
            ⚔ Дуэль
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
          <>
            {/* TEAM BANNER */}
            {teamCurrent ? (
              <Card className="mb-6 border-accent/30">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-accent">
                      Текущая команда
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-foreground">
                      {teamCurrent.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">
                      Участников: {teamCurrent.members.length}
                    </p>
                  </div>
                  <Button onClick={() => navigate("/team/current")}>
                    Открыть команду →
                  </Button>
                </div>
              </Card>
            ) : null}

            {queueState === "matched" ? (
              <MatchArena
                activeMatch={activeMatch}
                myUserId={myUserId}
                onNavigateTask={(taskId) => navigate(`/tasks/${taskId}/solve`)}
                onSurrender={requestSurrender}
                surrendering={surrendering}
              />
            ) : lastMatchResult ? (
              <PostMatchScreen
                result={lastMatchResult}
                myUserId={myUserId}
                opponentSnapshot={opponentSnapshot}
                onRematch={handleRematch}
                onNewMatch={() => {
                  setLastMatchResult(null);
                  setOpponentSnapshot(null);
                  setStatusNote(
                    "Нажми «Найти матч» — алгоритм подберёт соперника твоего уровня."
                  );
                }}
                rematchLoading={rematchLoading}
              />
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr,360px]">
                {/* ЛЕВАЯ КОЛОНКА — главная: радар + кнопки */}
                <Card className="relative overflow-hidden p-8">
                  {/* Decorative scan-lines */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.03]"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(0deg, transparent, transparent 3px, #FFD700 3px, #FFD700 4px)",
                    }}
                  />

                  <div className="relative">
                    <SearchRadar
                      state={queueState}
                      queueSize={queueInfo.queue_size}
                      queuePosition={queueInfo.queue_position}
                    />

                    {/* Status text */}
                    <div className="mt-8 text-center">
                      <p className="text-xl font-bold text-foreground sm:text-2xl">
                        {queueState === "searching"
                          ? "Ищем дуэль..."
                          : queueState === "matched"
                            ? "Соперник найден!"
                            : "Готов к бою?"}
                      </p>
                      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                        {statusNote}
                      </p>
                    </div>

                    {/* Stats row */}
                    <div className="mx-auto mt-6 max-w-md">
                      <ArenaStats />
                    </div>

                    {/* Rematch button */}
                    {lastMatchResult?.match_id ? (
                      <div className="mx-auto mt-6 max-w-md">
                        <button
                          type="button"
                          onClick={handleRematch}
                          disabled={rematchLoading}
                          className="inline-flex h-12 w-full items-center justify-center rounded-btn border border-green-500/40 bg-green-500/15 text-sm font-semibold text-green-300 transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {rematchLoading ? "Запускаем реванш..." : "⚔ Реванш — 1 клик"}
                        </button>
                      </div>
                    ) : null}

                    {/* Main CTA */}
                    <div className="mx-auto mt-6 max-w-md">
                      {queueState === "idle" ? (
                        <button
                          type="button"
                          onClick={runFindMatch}
                          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-btn bg-accent text-base font-bold text-black shadow-glow transition-all hover:bg-accent-hover hover:shadow-[0_0_32px_rgba(255,215,0,0.4)] active:scale-[0.99]"
                        >
                          ⚔ Найти матч 1v1
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={runLeaveQueue}
                          className="inline-flex h-14 w-full items-center justify-center rounded-btn border border-border bg-elevated text-base font-medium text-muted transition-colors hover:border-accent/50 hover:text-foreground"
                        >
                          ✕ Отменить поиск
                        </button>
                      )}
                    </div>

                    {error ? (
                      <div className="mx-auto mt-4 max-w-md rounded-btn border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
                        {error}
                      </div>
                    ) : null}
                  </div>
                </Card>

                {/* ПРАВАЯ КОЛОНКА — серия побед + квесты */}
                <div className="space-y-4">
                  {quests?.streak ? (
                    <StreakIndicator
                      current={quests.streak.current}
                      best={quests.streak.best}
                    />
                  ) : null}

                  <QuestsCard
                    quests={quests}
                    onClaim={handleClaimQuest}
                    claimingQuestKey={claimingQuestKey}
                  />

                  {/* Mini-helper card */}
                  <Card className="p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Совет дня
                    </h3>
                    <p className="mt-2 text-sm leading-snug text-foreground">
                      <span className="text-accent">3 победы подряд</span> = +25%
                      бонус PTS. Серия из 7 — +50%.
                    </p>
                    <LinkButton
                      to="/leaderboard"
                      variant="ghost"
                      className="mt-3 px-0 text-xs"
                    >
                      Посмотреть рейтинг →
                    </LinkButton>
                  </Card>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <SurrenderConfirmModal
        open={showSurrenderModal}
        loading={surrendering}
        error={surrenderModalError}
        onCancel={() => {
          if (!surrendering) {
            setShowSurrenderModal(false);
            setSurrenderModalError("");
          }
        }}
        onConfirm={runSurrender}
      />
    </div>
  );
}
