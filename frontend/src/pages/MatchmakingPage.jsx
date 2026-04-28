import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, getWebSocketBaseUrl } from "../api/client.js";
import { MatchArena } from "../features/matchmaking/components/MatchArena.jsx";
import { LeaderboardContent } from "./LeaderboardPage.jsx";

const PARTY_SIZE = 2;

function getMatchmakingSocketUrl(token) {
  const wsOrigin = getWebSocketBaseUrl();
  return `${wsOrigin}/matchmaking/ws?token=${encodeURIComponent(token)}`;
}

function getMyUserIdFromToken() {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) {
      return null;
    }

    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub_id ?? payload.user_id ?? null;
  } catch {
    return null;
  }
}

function translateQuestTitle(title) {
  if (!title) {
    return "";
  }

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

function QueueSlot({ label, active, complete }) {
  return (
    <div className="rounded-2xl border px-4 py-4 transition-colors" style={{ borderColor: complete ? "#FFD600" : active ? "rgba(255,214,0,0.45)" : "rgba(255,214,0,0.15)", background: complete ? "rgba(255,214,0,0.15)" : active ? "rgba(255,214,0,0.08)" : "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ background: complete ? "#FFD600" : active ? "#f5c400" : "rgba(255,255,255,0.25)", boxShadow: complete || active ? "0 0 12px rgba(255,214,0,0.7)" : "none" }} />
        <span className="text-sm font-medium text-white">{label}</span>
      </div>
    </div>
  );
}

function QueueFill({ queueSize, queuePosition }) {
  const clamped = Math.max(0, Math.min(queueSize, PARTY_SIZE));
  const pct = Math.round((clamped / PARTY_SIZE) * 100);

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-xs text-white/65"><span>Прогресс очереди</span><span>{clamped}/{PARTY_SIZE}</span></div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #b79000 0%, #FFD600 100%)" }} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <QueueSlot label="Вы в очереди" active complete={clamped >= 1} />
        <QueueSlot label="Подключаем соперника" active={clamped === 1} complete={clamped >= 2} />
      </div>
      <p className="text-xs text-white/55">Позиция в очереди: <span className="text-[#FFD600]">{queuePosition ?? "--"}</span></p>
    </div>
  );
}

function QuestPanel({ quests, onClaim, claimingQuestKey }) {
  if (!quests) {
    return null;
  }

  const sections = [
    { id: "daily", title: "Ежедневные PvP-квесты", data: quests.daily },
    { id: "weekly", title: "Недельные PvP-квесты", data: quests.weekly },
  ];

  return (
    <div className="mt-6 space-y-4">
      {sections.map((section) => (
        <div key={section.id} className="rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(255,214,0,0.15)", background: "rgba(255,255,255,0.01)" }}>
          <p className="text-[11px] uppercase tracking-wider text-[#FFD600]">{section.title}</p>
          <div className="mt-3 space-y-2.5">
            {(section.data?.quests || []).map((quest) => {
              const target = Math.max(1, Number(quest.target ?? 1));
              const progress = Math.max(0, Number(quest.progress ?? 0));
              const pct = Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
              const rowKey = `${section.id}:${quest.id}`;

              return (
                <div key={rowKey} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{translateQuestTitle(quest.title)}</p>
                      <p className="mt-0.5 text-xs text-white/60">{progress}/{target} • +{quest.reward_pts} PTS</p>
                    </div>
                    {quest.completed && !quest.claimed ? (
                      <button type="button" onClick={() => onClaim(section.id, quest.id)} disabled={claimingQuestKey === rowKey} className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-85 disabled:opacity-50" style={{ background: "#FFD600", color: "#111" }}>
                        {claimingQuestKey === rowKey ? "..." : "Забрать"}
                      </button>
                    ) : (
                      <span className="text-[11px] text-white/50">{quest.claimed ? "Получено" : quest.completed ? "Готово" : "В прогрессе"}</span>
                    )}
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #b79000 0%, #FFD600 100%)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MatchmakingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "leaderboard" ? "leaderboard" : "duel";
  const myUserId = useMemo(() => getMyUserIdFromToken(), []);
  const [activeMatch, setActiveMatch] = useState(null);
  const [queueInfo, setQueueInfo] = useState({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
  const [searching, setSearching] = useState(false);
  const [statusNote, setStatusNote] = useState("Нажмите «Найти матч», чтобы встать в PvP-очередь.");
  const [error, setError] = useState("");
  const [teamCurrent, setTeamCurrent] = useState(null);
  const [quests, setQuests] = useState(null);
  const [claimingQuestKey, setClaimingQuestKey] = useState("");
  const [lastMatchResult, setLastMatchResult] = useState(null);
  const [rematchLoading, setRematchLoading] = useState(false);
  const [surrendering, setSurrendering] = useState(false);

  const queueState = useMemo(() => {
    if (activeMatch) {
      return "matched";
    }
    if (searching) {
      return "searching";
    }
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
    } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const current = await apiFetch("/matchmaking/active");
        if (!mounted) {
          return;
        }

        if (current) {
          setActiveMatch(current);
          setSearching(false);
          setStatusNote("Активная дуэль восстановлена.");
        }
      } catch {}
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
        if (mounted) {
          setTeamCurrent(currentTeam);
        }
      } catch {
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
    if (!token) {
      return undefined;
    }

    const ws = new WebSocket(getMatchmakingSocketUrl(token));
    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      const data = payload.data ?? {};

      if (payload.event === "queue_update") {
        setQueueInfo({ queue_size: data.queue_size ?? 0, queue_position: data.queue_position ?? null, total: data.total ?? PARTY_SIZE });
        setSearching(data.status === "queued");
        if (data.status === "queued") {
          setStatusNote("Ищем соперника с близким PTS...");
        }
      }

      if (payload.event === "match_found" || payload.event === "active_match") {
        setActiveMatch((prev) => ({ ...(prev ?? {}), ...data }));
        setLastMatchResult(null);
        setSearching(false);
        setSurrendering(false);
        setStatusNote("Соперник найден. Переходим в дуэль.");
        apiFetch("/matchmaking/active").then((current) => {
          if (current) {
            setActiveMatch(current);
          }
        }).catch(() => {});
      }

      if (payload.event === "match_finished") {
        setLastMatchResult(data);
        setActiveMatch(null);
        setSearching(false);
        setRematchLoading(false);
        setSurrendering(false);
        setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });

        const iWon = data.winner_user_id === myUserId;
        if (iWon) {
          const streak = Number(data.winner_streak ?? 0);
          const bonus = Number(data.winner_streak_bonus ?? 0);
          const streakNote = streak >= 2 ? ` Серия побед: ${streak} (+${bonus} бонус PTS).` : "";
          setStatusNote(data.reason === "surrender" ? `Соперник сдался. Победа!${streakNote}` : `Победа в матче!${streakNote}`);
        } else {
          setStatusNote(data.reason === "surrender" ? "Вы сдались в матче." : "Матч завершен. Попробуйте реванш.");
        }

        loadQuests();
      }

      if (payload.event === "rematch_offered") {
        setLastMatchResult((prev) => ({ ...(prev ?? {}), match_id: data.match_id }));
        setStatusNote("Соперник предлагает реванш. Нажмите кнопку «Реванш».");
      }
    });

    return () => {
      ws.close();
    };
  }, [loadQuests, myUserId]);

  async function runFindMatch() {
    if (queueState === "searching") {
      return;
    }

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
        setQueueInfo({ queue_size: result.queue_size ?? 1, queue_position: result.queue_position ?? null, total: PARTY_SIZE });
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
    } catch {}

    setActiveMatch(null);
    setSearching(false);
    setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
    setStatusNote("Поиск отменен.");
  }

  async function runSurrender() {
    if (!activeMatch || surrendering) {
      return;
    }

    const confirmed = window.confirm("Вы точно уверены? Вы потеряете PTS!");
    if (!confirmed) {
      return;
    }

    setError("");
    setSurrendering(true);

    try {
      const payload = await apiFetch("/matchmaking/surrender", { method: "POST" });
      setLastMatchResult(payload);
      setActiveMatch(null);
      setSearching(false);
      setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
      await loadQuests();
      setStatusNote("Вы сдались в матче. PTS были уменьшены.");
    } catch (eventError) {
      const message = eventError?.message || "";
      const alreadyFinished = eventError?.status === 409 || message.includes("Match is already finished") || message.includes("No active match to surrender");

      if (alreadyFinished) {
        setActiveMatch(null);
        setSearching(false);
        setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
        setStatusNote("Матч уже завершён.");
        await loadQuests();
      } else {
        setError(message);
      }
    }

    setSurrendering(false);
  }

  async function handleClaimQuest(period, questId) {
    const key = `${period}:${questId}`;
    setClaimingQuestKey(key);
    setError("");

    try {
      const reward = await apiFetch(`/matchmaking/quests/${period}/${questId}/claim`, { method: "POST" });
      setStatusNote(`Квест завершен: +${reward.reward_pts ?? 0} PTS`);
      await loadQuests();
    } catch (eventError) {
      setError(eventError?.message || "Не удалось забрать награду за квест.");
    } finally {
      setClaimingQuestKey("");
    }
  }

  async function handleRematch() {
    if (!lastMatchResult?.match_id || rematchLoading) {
      return;
    }

    setRematchLoading(true);
    setError("");

    try {
      const result = await apiFetch("/matchmaking/rematch", { method: "POST", body: { match_id: lastMatchResult.match_id } });

      if (result.status === "matched" || result.status === "already_in_match") {
        setActiveMatch(result);
        setSearching(false);
        setLastMatchResult(null);
        setStatusNote("Реванш начинается!");
        return;
      }

      setStatusNote(result.status === "waiting_rematch" ? "Реванш предложен. Ждем подтверждение соперника." : result.message || "Ожидаем подтверждение реванша.");
    } catch (eventError) {
      setError(eventError?.message || "Не удалось запустить реванш.");
    } finally {
      setRematchLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-7 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-white transition-all duration-300 hover:text-[#FFD600] hover:[text-shadow:0_0_14px_rgba(255,214,0,0.55)] sm:text-5xl">
            PvP Подбор Соперника 1v1
          </h1>
          <p className="mt-2 text-sm text-white/55">Очередь, подключение соперника и дуэльные задания 1v1.</p>
        </div>

        <div className="mx-auto mb-6 flex max-w-xl rounded-2xl border border-yellow-500/20 bg-slate-950/70 p-1">
          <button type="button" onClick={() => switchTab("duel")} className={["h-11 flex-1 rounded-xl text-sm font-semibold transition", activeTab === "duel" ? "bg-[#FFD600] text-slate-950 shadow-[0_0_20px_rgba(255,214,0,0.25)]" : "text-white/75 hover:text-white"].join(" ")}>Дуэль</button>
          <button type="button" onClick={() => switchTab("leaderboard")} className={["h-11 flex-1 rounded-xl text-sm font-semibold transition", activeTab === "leaderboard" ? "bg-[#FFD600] text-slate-950 shadow-[0_0_20px_rgba(255,214,0,0.25)]" : "text-white/75 hover:text-white"].join(" ")}>Рейтинг</button>
        </div>

        {activeTab === "leaderboard" ? <LeaderboardContent embedded /> : (
          <>
            {teamCurrent ? (
              <div className="mb-6 rounded-2xl border border-yellow-500/20 bg-slate-950 p-5 text-sm text-white">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-yellow-300">Текущая команда</p>
                    <h2 className="mt-2 text-xl font-semibold">{teamCurrent.name}</h2>
                    <p className="mt-1 text-sm text-slate-400">Участников: {teamCurrent.members.length}</p>
                  </div>
                  <button type="button" onClick={() => navigate("/team/current")} className="rounded-2xl bg-[#FFD600] px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(255,214,0,0.25)] transition hover:bg-yellow-300">Открыть команду</button>
                </div>
              </div>
            ) : null}

            {queueState === "matched" ? (
              <MatchArena activeMatch={activeMatch} myUserId={myUserId} onNavigateTask={(taskId) => navigate(`/tasks/${taskId}/solve`)} onSurrender={runSurrender} surrendering={surrendering} />
            ) : (
              <div className="mx-auto max-w-xl rounded-3xl border p-8" style={{ borderColor: "rgba(255,214,0,0.15)", background: "#111" }}>
                <div className="mb-6 text-center">
                  <p className="text-xl font-semibold text-white">{queueState === "searching" ? "Ищем дуэль..." : "Готовы к PvP?"}</p>
                  <p className="mt-2 text-sm text-white/55">{statusNote}</p>
                </div>

                <QueueFill queueSize={queueInfo.queue_size} queuePosition={queueInfo.queue_position} />

                {lastMatchResult?.match_id ? (
                  <div className="mt-4">
                    <button type="button" onClick={handleRematch} disabled={rematchLoading} className="h-11 w-full rounded-xl border text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ borderColor: "rgba(34,197,94,0.45)", background: "rgba(34,197,94,0.16)" }}>
                      {rematchLoading ? "Запускаем реванш..." : "Реванш (1 клик)"}
                    </button>
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col gap-3">
                  {queueState === "idle" ? (
                    <button type="button" onClick={runFindMatch} className="h-12 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85" style={{ background: "#FFD600", color: "#111" }}>Найти матч 1v1</button>
                  ) : (
                    <button type="button" onClick={runLeaveQueue} className="h-12 rounded-xl border text-sm font-medium text-white/80 transition-colors hover:text-white" style={{ borderColor: "rgba(255,214,0,0.2)", background: "transparent" }}>Отменить поиск</button>
                  )}
                </div>

                {quests?.streak ? (
                  <div className="mt-4 rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(255,214,0,0.15)" }}>
                    <p className="text-[11px] uppercase tracking-wider text-[#FFD600]">Серия побед</p>
                    <p className="mt-1 text-sm text-white">Текущая серия: <span className="font-semibold text-[#FFD600]">{quests.streak.current}</span> • Лучшая: <span className="font-semibold text-[#FFD600]">{quests.streak.best}</span></p>
                  </div>
                ) : null}

                <QuestPanel quests={quests} onClaim={handleClaimQuest} claimingQuestKey={claimingQuestKey} />
                {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
