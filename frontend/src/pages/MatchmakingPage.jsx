import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { apiFetch, getWebSocketBaseUrl, resolveAssetUrl } from "../api/client";
import { LeaderboardContent } from "./LeaderboardPage.jsx";

const PARTY_SIZE = 2;

function getMatchmakingSocketUrl(token) {
  const wsOrigin = getWebSocketBaseUrl();
  return `${wsOrigin}/matchmaking/ws?token=${encodeURIComponent(token)}`;
}

function getMatchRoomSocketUrl(matchId, token) {
  const wsOrigin = getWebSocketBaseUrl();
  return `${wsOrigin}/matchmaking/match/${matchId}/ws?token=${encodeURIComponent(token)}`;
}

function formatCountdown(totalSeconds) {
  if (totalSeconds == null || totalSeconds < 0) return "--:--";
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getMyUserIdFromToken() {
  try {
    const token = localStorage.getItem("access_token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub_id ?? payload.user_id ?? null;
  } catch {
    return null;
  }
}

function getOpponentFromParticipants(participants, myUserId) {
  if (!Array.isArray(participants)) return null;
  return participants.find((item) => item.user_id !== myUserId) ?? null;
}

const ROLE_BADGE_PALETTES = {
  "back-end": {
    border: "rgba(99,102,241,0.55)",
    bg: "rgba(67,56,202,0.24)",
    text: "#c7d2fe",
    shadow: "rgba(99,102,241,0.35)",
  },
  "front-end": {
    border: "rgba(6,182,212,0.55)",
    bg: "rgba(8,145,178,0.24)",
    text: "#a5f3fc",
    shadow: "rgba(6,182,212,0.35)",
  },
  "full-stack": {
    border: "rgba(34,197,94,0.55)",
    bg: "rgba(22,163,74,0.24)",
    text: "#bbf7d0",
    shadow: "rgba(34,197,94,0.35)",
  },
  "project manager": {
    border: "rgba(244,114,182,0.55)",
    bg: "rgba(190,24,93,0.24)",
    text: "#fbcfe8",
    shadow: "rgba(244,114,182,0.35)",
  },
  "ui/ux": {
    border: "rgba(168,85,247,0.55)",
    bg: "rgba(126,34,206,0.24)",
    text: "#e9d5ff",
    shadow: "rgba(168,85,247,0.35)",
  },
  "ai/ml": {
    border: "rgba(245,158,11,0.55)",
    bg: "rgba(180,83,9,0.24)",
    text: "#fde68a",
    shadow: "rgba(245,158,11,0.35)",
  },
  devops: {
    border: "rgba(148,163,184,0.55)",
    bg: "rgba(71,85,105,0.26)",
    text: "#e2e8f0",
    shadow: "rgba(148,163,184,0.35)",
  },
  devop: {
    border: "rgba(148,163,184,0.55)",
    bg: "rgba(71,85,105,0.26)",
    text: "#e2e8f0",
    shadow: "rgba(148,163,184,0.35)",
  },
  qa: {
    border: "rgba(45,212,191,0.55)",
    bg: "rgba(15,118,110,0.24)",
    text: "#99f6e4",
    shadow: "rgba(45,212,191,0.35)",
  },
};

const DEFAULT_ROLE_BADGE = {
  border: "rgba(255,214,0,0.45)",
  bg: "rgba(255,214,0,0.12)",
  text: "#FFD600",
  shadow: "rgba(255,214,0,0.28)",
};

function getRolePalette(roleLabel) {
  const key = String(roleLabel ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return ROLE_BADGE_PALETTES[key] || DEFAULT_ROLE_BADGE;
}

function getBadgePresentation(badge) {
  return { icon: "R", ...getRolePalette(badge.label) };
}

function QueueSlot({ label, active, complete }) {
  return (
    <div
      className="rounded-2xl border px-4 py-4 transition-colors"
      style={{
        borderColor: complete ? "#FFD600" : active ? "rgba(255,214,0,0.45)" : "rgba(255,214,0,0.15)",
        background: complete ? "rgba(255,214,0,0.15)" : active ? "rgba(255,214,0,0.08)" : "rgba(255,255,255,0.02)",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="h-3 w-3 rounded-full"
          style={{
            background: complete ? "#FFD600" : active ? "#f5c400" : "rgba(255,255,255,0.25)",
            boxShadow: complete || active ? "0 0 12px rgba(255,214,0,0.7)" : "none",
          }}
        />
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
      <div className="flex items-center justify-between text-xs text-white/65">
        <span>Прогресс очереди</span>
        <span>
          {clamped}/{PARTY_SIZE}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #b79000 0%, #FFD600 100%)",
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <QueueSlot label="Вы в очереди" active complete={clamped >= 1} />
        <QueueSlot label="Подключаем соперника" active={clamped === 1} complete={clamped >= 2} />
      </div>
      <p className="text-xs text-white/55">
        Позиция в очереди: <span className="text-[#FFD600]">{queuePosition ?? "--"}</span>
      </p>
    </div>
  );
}

function QuestPanel({ quests, onClaim, claimingQuestKey }) {
  if (!quests) return null;

  const sections = [
    { id: "daily", title: "Ежедневные PvP-квесты", data: quests.daily },
    { id: "weekly", title: "Недельные PvP-квесты", data: quests.weekly },
  ];

  return (
    <div className="mt-6 space-y-4">
      {sections.map((section) => (
        <div
          key={section.id}
          className="rounded-2xl border px-4 py-3"
          style={{ borderColor: "rgba(255,214,0,0.15)", background: "rgba(255,255,255,0.01)" }}
        >
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
                      <p className="truncate text-sm font-medium text-white">{quest.title}</p>
                      <p className="mt-0.5 text-xs text-white/60">
                        {progress}/{target} • +{quest.reward_pts} PTS
                      </p>
                    </div>
                    {quest.completed && !quest.claimed ? (
                      <button
                        type="button"
                        onClick={() => onClaim(section.id, quest.id)}
                        disabled={claimingQuestKey === rowKey}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
                        style={{ background: "#FFD600", color: "#111" }}
                      >
                        {claimingQuestKey === rowKey ? "..." : "Забрать"}
                      </button>
                    ) : (
                      <span className="text-[11px] text-white/50">
                        {quest.claimed ? "Получено" : quest.completed ? "Готово" : "В прогрессе"}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: "linear-gradient(90deg, #b79000 0%, #FFD600 100%)" }}
                    />
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

function OpponentIntelPanel({ opponentUserId, online }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!opponentUserId) {
      setProfile(null);
      return;
    }
    let mounted = true;
    setLoading(true);
    apiFetch(`/users/${opponentUserId}/profile`)
      .then((data) => {
        if (mounted) setProfile(data);
      })
      .catch(() => {
        if (mounted) setProfile(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [opponentUserId]);

  const badges = useMemo(() => {
    const role = String(profile?.role ?? "").trim();
    return role ? [{ label: role, tone: "role" }] : [];
  }, [profile?.role]);

  const bannerUrl = resolveAssetUrl(profile?.banner_url || "");
  const avatarUrl = resolveAssetUrl(profile?.avatar_url || "");
  const displayName = profile?.nickname || profile?.display_name || "Unknown";
  const mentionName = profile?.nickname || profile?.display_name || "unknown";

  return (
    <aside
      className="h-full rounded-2xl border p-4"
      style={{ borderColor: "rgba(255,214,0,0.15)", background: "#111" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-[#FFD600]">Профиль соперника</h3>
        <span
          className="text-[11px] font-medium"
          style={{ color: online ? "#4ade80" : "rgba(255,255,255,0.45)" }}
        >
          {online ? "онлайн" : "оффлайн"}
        </span>
      </div>

      {!opponentUserId ? (
        <p className="text-sm text-white/50">Ожидаем профиль соперника...</p>
      ) : loading ? (
        <p className="text-sm text-white/50">Загружаем профиль...</p>
      ) : !profile ? (
        <p className="text-sm text-white/50">Профиль недоступен.</p>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
            <div className="relative h-24">
              {bannerUrl ? (
                <img src={bannerUrl} alt="Баннер соперника" className="h-full w-full object-cover" />
              ) : (
                <div
                  className="h-full w-full"
                  style={{ background: "linear-gradient(135deg, rgba(25,38,66,1) 0%, rgba(10,15,25,1) 100%)" }}
                />
              )}
            </div>

            <div className="px-4 pb-4">
              <div className="-mt-7 flex items-end gap-3">
                <div className="relative h-16 w-16 shrink-0 rounded-full border-[3px] border-[#111] bg-slate-800">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Аватар соперника" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full text-xl font-bold text-[#FFD600]">
                      {displayName[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[#111]"
                    style={{
                      background: online ? "#22c55e" : "#6b7280",
                      boxShadow: online ? "0 0 10px rgba(34,197,94,0.8)" : "none",
                    }}
                  />
                </div>

                <div className="min-w-0 pb-1">
                  <p className="truncate text-base font-semibold text-white">{displayName}</p>
                  <p className="truncate text-xs text-white/60">@{mentionName}</p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-white/70">
                <span>PTS {profile.pts ?? 0}</span>
                <span style={{ color: online ? "#4ade80" : "rgba(255,255,255,0.5)" }}>
                  {online ? "онлайн" : "оффлайн"}
                </span>
              </div>

              {profile.bio ? (
                <p className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs leading-5 text-white/75">
                  {profile.bio}
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wider text-white/50">Роль</p>
            <div className="flex flex-wrap gap-2">
              {badges.length > 0 ? (
                badges.map((badge, idx) => {
                  const view = getBadgePresentation(badge);
                  return (
                    <span
                      key={`${badge.label}-${idx}`}
                      className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium backdrop-blur-sm"
                      style={{
                        borderColor: view.border,
                        background: `linear-gradient(180deg, rgba(255,255,255,0.08) 0%, ${view.bg} 100%)`,
                        color: view.text,
                        boxShadow: `0 6px 14px ${view.shadow}`,
                      }}
                    >
                      <span
                        className="mr-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full border text-[10px] font-semibold"
                        style={{
                          borderColor: view.border,
                          color: view.text,
                          background: "rgba(0,0,0,0.28)",
                        }}
                      >
                        {view.icon}
                      </span>
                      <span className="leading-none">{badge.label}</span>
                    </span>
                  );
                })
              ) : (
                <span className="text-xs text-white/50">Роль не указана</span>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function ParticipantsList({ participants, myUserId, onlineIds }) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: "rgba(255,214,0,0.15)", background: "#111" }}>
      <p className="mb-2 text-[11px] uppercase tracking-wider text-[#FFD600]">Участники арены</p>
      <div className="space-y-2">
        {participants.map((p) => {
          const isMe = p.user_id === myUserId;
          return (
            <div
              key={p.user_id}
              className="flex items-center justify-between rounded-xl border px-3 py-2"
              style={{ borderColor: "rgba(255,214,0,0.13)", background: "rgba(255,255,255,0.01)" }}
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-white">
                  {p.display_name || p.nickname}
                  {isMe ? " (вы)" : ""}
                </p>
                <p className="truncate text-xs text-white/55">@{p.nickname}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">{p.pts}</span>
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: onlineIds.includes(p.user_id) ? "#4ade80" : "#6b7280" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChatPanel({ messages, myUserId, onSend }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function submit(event) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div
      className="flex h-full flex-col rounded-2xl border"
      style={{ borderColor: "rgba(255,214,0,0.15)", background: "#111" }}
    >
      <div className="border-b px-4 py-3" style={{ borderColor: "rgba(255,214,0,0.12)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FFD600]">Чат</p>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? <p className="text-sm text-white/45">Сообщений пока нет.</p> : null}
        {messages.map((msg, idx) => {
          const mine = msg.user_id === myUserId;
          return (
            <div key={`${msg.user_id}-${idx}-${msg.text}`} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[82%] rounded-xl px-3 py-2 text-xs"
                style={{
                  background: mine ? "#FFD600" : "rgba(255,255,255,0.06)",
                  color: mine ? "#111" : "#f8fafc",
                }}
              >
                <p className="mb-1 text-[10px] font-semibold opacity-80">{mine ? "вы" : msg.display_name || msg.nickname}</p>
                <p>{msg.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t px-3 py-3" style={{ borderColor: "rgba(255,214,0,0.1)" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Написать сообщение..."
          className="h-10 flex-1 rounded-xl bg-black px-3 text-sm text-white placeholder:text-white/35 focus:outline-none"
          style={{ border: "1px solid rgba(255,214,0,0.2)" }}
        />
        <button
          type="submit"
          className="h-10 rounded-xl px-4 text-sm font-semibold transition-opacity hover:opacity-85"
          style={{ background: "#FFD600", color: "#111" }}
        >
          Отправить
        </button>
      </form>
    </div>
  );
}

function MatchArena({ activeMatch, myUserId, onNavigateTask, onSurrender }) {
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [onlineIds, setOnlineIds] = useState([]);
  const [secondsRemaining, setSecondsRemaining] = useState(activeMatch?.seconds_remaining ?? null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (activeMatch?.seconds_remaining != null) {
      setSecondsRemaining(activeMatch.seconds_remaining);
      return;
    }
    if (!activeMatch?.ends_at) {
      setSecondsRemaining(null);
      return;
    }
    const deadline = new Date(activeMatch.ends_at).getTime();
    const tick = () => setSecondsRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeMatch?.ends_at, activeMatch?.seconds_remaining]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token || !activeMatch?.match_id) return;

    const ws = new WebSocket(getMatchRoomSocketUrl(activeMatch.match_id, token));
    wsRef.current = ws;

    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      const data = payload.data ?? {};
      if (payload.event === "room_state") {
        setParticipants(data.participants ?? []);
        setOnlineIds(data.online ?? []);
      }
      if (payload.event === "user_joined" || payload.event === "user_left") {
        setOnlineIds(data.online ?? []);
      }
      if (payload.event === "chat") {
        const text = String(data.text ?? "").trim();
        if (!text) return;
        setMessages((prev) => [...prev, { ...data, text }]);
      }
    });

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [activeMatch?.match_id]);

  const opponentFromParticipants = useMemo(
    () => getOpponentFromParticipants(participants, myUserId),
    [participants, myUserId],
  );
  const opponent = opponentFromParticipants ?? activeMatch?.opponent ?? null;
  const opponentOnline = opponent ? onlineIds.includes(opponent.user_id) : false;

  function sendChatMessage(text) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ event: "chat", text }));
  }

  return (
    <div className="grid h-[560px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-h-0 flex-col gap-4">
        <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(255,214,0,0.15)", background: "#111" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-[#FFD600]">PvP Дуэль 1v1</h2>
              <p className="text-sm text-white/65">
                До конца: <span className="font-mono text-white">{formatCountdown(secondsRemaining)}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onNavigateTask(activeMatch.task_id)}
                className="rounded-xl px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-85"
                style={{ background: "#FFD600", color: "#111" }}
              >
                Открыть задачу
              </button>
              <button
                type="button"
                onClick={onSurrender}
                className="rounded-xl border px-4 py-2 text-sm text-white/70 transition-colors hover:text-white"
                style={{ borderColor: "rgba(255,214,0,0.2)", background: "transparent" }}
              >
                Сдаться
              </button>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <ChatPanel messages={messages} myUserId={myUserId} onSend={sendChatMessage} />
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-4">
        <OpponentIntelPanel opponentUserId={opponent?.user_id ?? null} online={opponentOnline} />
        <ParticipantsList participants={participants} myUserId={myUserId} onlineIds={onlineIds} />
      </div>
    </div>
  );
}

export function MatchmakingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 767px)");
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

  const state = useMemo(() => {
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
    } catch {
      // ignore
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
      } catch {
        // ignore
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
        if (!mounted) return;
        setTeamCurrent(currentTeam);
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
        setSearching(false);
        setStatusNote("Соперник найден. Переходим в дуэль.");
        apiFetch("/matchmaking/active")
          .then((current) => {
            if (current) setActiveMatch(current);
          })
          .catch(() => {});
      }

      if (payload.event === "match_finished") {
        setLastMatchResult(data);
        setActiveMatch(null);
        setSearching(false);
        setRematchLoading(false);
        setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });

        const iWon = data.winner_user_id === myUserId;
        if (iWon) {
          const streak = Number(data.winner_streak ?? 0);
          const bonus = Number(data.winner_streak_bonus ?? 0);
          const streakNote = streak >= 2 ? ` Серия побед: ${streak} (+${bonus} бонус PTS).` : "";
          if (data.reason === "surrender") {
            setStatusNote(`Соперник сдался. Победа!${streakNote}`);
          } else {
            setStatusNote(`Победа в матче!${streakNote}`);
          }
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

  async function handleFindMatch() {
    if (state === "searching") return;
    setError("");
    setSearching(true);
    setStatusNote("Подключаем к PvP-очереди...");
    try {
      const res = await apiFetch("/matchmaking/queue", { method: "POST" });
      if (res.status === "matched" || res.status === "already_in_match") {
        setActiveMatch(res);
        setSearching(false);
        setStatusNote("Матч найден.");
        return;
      }
      if (res.status === "queued") {
        setQueueInfo({
          queue_size: res.queue_size ?? 1,
          queue_position: res.queue_position ?? null,
          total: PARTY_SIZE,
        });
        setStatusNote("Вы в очереди. Ожидаем соперника...");
        return;
      }
      setError(res.message || "Ошибка матчмейкинга.");
      setSearching(false);
    } catch (e) {
      setError(e?.message || "Ошибка матчмейкинга.");
      setSearching(false);
    }
  }

  async function handleLeaveQueue() {
    setError("");
    try {
      await apiFetch("/matchmaking/queue", { method: "DELETE" });
    } catch {
      // ignore
    }
    setActiveMatch(null);
    setSearching(false);
    setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
    setStatusNote("Поиск отменен.");
  }

  async function handleSurrender() {
    if (!activeMatch) return;
    const confirmed = window.confirm("Вы точно уверены? Вы потеряете PTS!");
    if (!confirmed) return;
    setError("");
    try {
      await apiFetch("/matchmaking/surrender", { method: "POST" });
      setActiveMatch(null);
      setSearching(false);
      setQueueInfo({ queue_size: 0, queue_position: null, total: PARTY_SIZE });
      setStatusNote("Вы сдались в матче. PTS были уменьшены.");
    } catch (e) {
      setError(e?.message || "Не удалось сдаться в матче.");
    }
  }

  async function handleClaimQuest(period, questId) {
    const key = `${period}:${questId}`;
    setClaimingQuestKey(key);
    setError("");
    try {
      const reward = await apiFetch(`/matchmaking/quests/${period}/${questId}/claim`, { method: "POST" });
      setStatusNote(`Квест завершен: +${reward.reward_pts ?? 0} PTS`);
      await loadQuests();
    } catch (e) {
      setError(e?.message || "Не удалось забрать награду за квест.");
    } finally {
      setClaimingQuestKey("");
    }
  }

  async function handleRematch() {
    if (!lastMatchResult?.match_id || rematchLoading) return;
    setRematchLoading(true);
    setError("");
    try {
      const res = await apiFetch("/matchmaking/rematch", {
        method: "POST",
        body: { match_id: lastMatchResult.match_id },
      });
      if (res.status === "matched" || res.status === "already_in_match") {
        setActiveMatch(res);
        setSearching(false);
        setLastMatchResult(null);
        setStatusNote("Реванш начинается!");
        return;
      }
      if (res.status === "waiting_rematch") {
        setStatusNote("Реванш предложен. Ждем подтверждение соперника.");
      } else {
        setStatusNote(res.message || "Ожидаем подтверждение реванша.");
      }
    } catch (e) {
      setError(e?.message || "Не удалось запустить реванш.");
    } finally {
      setRematchLoading(false);
    }
  }

  if (isMobile) return <Navigate to="/dashboard" replace />;

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
          <button
            type="button"
            onClick={() => switchTab("duel")}
            className={[
              "h-11 flex-1 rounded-xl text-sm font-semibold transition",
              activeTab === "duel"
                ? "bg-[#FFD600] text-slate-950 shadow-[0_0_20px_rgba(255,214,0,0.25)]"
                : "text-white/75 hover:text-white",
            ].join(" ")}
          >
            Дуэль
          </button>
          <button
            type="button"
            onClick={() => switchTab("leaderboard")}
            className={[
              "h-11 flex-1 rounded-xl text-sm font-semibold transition",
              activeTab === "leaderboard"
                ? "bg-[#FFD600] text-slate-950 shadow-[0_0_20px_rgba(255,214,0,0.25)]"
                : "text-white/75 hover:text-white",
            ].join(" ")}
          >
            Рейтинг
          </button>
        </div>

        {activeTab === "leaderboard" ? (
          <LeaderboardContent embedded />
        ) : (
          <>
            {teamCurrent ? (
          <div className="mb-6 rounded-2xl border border-yellow-500/20 bg-slate-950 p-5 text-sm text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-yellow-300">Текущая команда</p>
                <h2 className="mt-2 text-xl font-semibold">{teamCurrent.name}</h2>
                <p className="mt-1 text-sm text-slate-400">Участников: {teamCurrent.members.length}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/team/current")}
                className="rounded-2xl bg-[#FFD600] px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(255,214,0,0.25)] transition hover:bg-yellow-300"
              >
                Открыть команду
              </button>
            </div>
          </div>
        ) : null}

        {state === "matched" ? (
          <MatchArena
            activeMatch={activeMatch}
            myUserId={myUserId}
            onNavigateTask={(taskId) => navigate(`/tasks/${taskId}/solve`)}
            onSurrender={handleSurrender}
          />
        ) : (
          <div
            className="mx-auto max-w-xl rounded-3xl border p-8"
            style={{ borderColor: "rgba(255,214,0,0.15)", background: "#111" }}
          >
            <div className="mb-6 text-center">
              <p className="text-xl font-semibold text-white">{state === "searching" ? "Ищем дуэль..." : "Готовы к PvP?"}</p>
              <p className="mt-2 text-sm text-white/55">{statusNote}</p>
            </div>

            <QueueFill queueSize={queueInfo.queue_size} queuePosition={queueInfo.queue_position} />

            {lastMatchResult?.match_id ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleRematch}
                  disabled={rematchLoading}
                  className="h-11 w-full rounded-xl border text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ borderColor: "rgba(34,197,94,0.45)", background: "rgba(34,197,94,0.16)" }}
                >
                  {rematchLoading ? "Запускаем реванш..." : "Реванш (1 клик)"}
                </button>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3">
              {state === "idle" ? (
                <button
                  type="button"
                  onClick={handleFindMatch}
                  className="h-12 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85"
                  style={{ background: "#FFD600", color: "#111" }}
                >
                  Найти матч 1v1
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLeaveQueue}
                  className="h-12 rounded-xl border text-sm font-medium text-white/80 transition-colors hover:text-white"
                  style={{ borderColor: "rgba(255,214,0,0.2)", background: "transparent" }}
                >
                  Отменить поиск
                </button>
              )}
            </div>

            {quests?.streak ? (
              <div className="mt-4 rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(255,214,0,0.15)" }}>
                <p className="text-[11px] uppercase tracking-wider text-[#FFD600]">Win Streak</p>
                <p className="mt-1 text-sm text-white">
                  Текущая серия: <span className="font-semibold text-[#FFD600]">{quests.streak.current}</span> • Лучшая:{" "}
                  <span className="font-semibold text-[#FFD600]">{quests.streak.best}</span>
                </p>
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
