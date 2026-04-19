import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";

// ─── helpers ──────────────────────────────────────────────────────────────────

function getMatchmakingSocketUrl(token) {
  const origin = import.meta.env.VITE_API_URL ?? window.location.origin;
  const wsOrigin = origin.replace(/^http/, "ws").replace(/\/+$/, "");
  return `${wsOrigin}/matchmaking/ws?token=${encodeURIComponent(token)}`;
}

function getMatchRoomSocketUrl(matchId, token) {
  const origin = import.meta.env.VITE_API_URL ?? window.location.origin;
  const wsOrigin = origin.replace(/^http/, "ws").replace(/\/+$/, "");
  return `${wsOrigin}/matchmaking/match/${matchId}/ws?token=${encodeURIComponent(token)}`;
}

function formatCountdown(totalSeconds) {
  if (totalSeconds == null || totalSeconds < 0) return "—";
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function levelColor(level) {
  const map = {
    beginner: "#6ee7b7",
    intermediate: "#60a5fa",
    advanced: "#f472b6",
    expert: "#FFD600",
  };
  return map[level] ?? "#94a3b8";
}

// ─── MiniProfile (Discord-style modal card) ───────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? "";

function MiniProfile({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    apiFetch(`/users/${userId}/profile`)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [userId]);

  if (!userId) return null;

  const initials = profile
    ? (profile.nickname || profile.display_name || "?").slice(0, 2).toUpperCase()
    : "..";

  const levelColors = {
    beginner: "#6366f1",
    junior: "#22c55e",
    strong_junior: "#f59e0b",
    middle: "#ef4444",
  };

  const levelLabels = {
    beginner: "Beginner",
    junior: "Junior",
    strong_junior: "Strong Junior",
    middle: "Middle",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:w-80 rounded-t-2xl sm:rounded-2xl overflow-hidden border border-border"
        style={{ background: "var(--color-canvas, #1a1a2e)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Баннер */}
        <div
          className="h-20 w-full relative"
          style={{
            background: profile?.banner_url
              ? `url(${profile.banner_url}) center/cover`
              : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          }}
        />

        {/* Аватар */}
        <div className="px-4 pb-4">
          <div className="relative -mt-8 mb-3">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="avatar"
                className="w-16 h-16 rounded-full border-4 border-canvas object-cover"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full border-4 border-canvas flex items-center justify-center text-xl font-bold"
                style={{ background: "#6366f1", color: "white" }}
              >
                {initials}
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-sm text-muted py-4 text-center">Загрузка...</div>
          ) : profile ? (
            <>
              {/* Имя и уровень */}
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-foreground text-base">
                  {profile.nickname || profile.display_name}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: `${levelColors[profile.level]}22`,
                    color: levelColors[profile.level],
                  }}
                >
                  {levelLabels[profile.level] || profile.level}
                </span>
              </div>

              {/* PTS */}
              <div className="text-sm text-muted mb-3">PTS {profile.pts}</div>

              {/* Bio */}
              {profile.bio && (
                <div className="text-sm text-foreground mb-3 border-t border-border pt-3">
                  {profile.bio}
                </div>
              )}

              {/* Навыки */}
              {profile.skills?.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted uppercase tracking-wider mb-2">Навыки</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((skill) => (
                      <div key={skill.skill_name} className="flex items-center gap-1">
                        <span className="text-xs px-2 py-1 rounded-lg border border-border text-foreground">
                          {skill.skill_name}
                        </span>
                        <span className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span
                              key={i}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                background: i < skill.proficiency ? "#6366f1" : "#334155",
                              }}
                            />
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted">Профиль не найден</div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-xl border border-border py-2 text-sm text-muted"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ParticipantRow ───────────────────────────────────────────────────────────

function ParticipantRow({ participant, online, isMe, onClick }) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-yellow-500/5"
      onClick={() => onClick(participant.user_id)}
    >
      <div
        className="relative h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-black"
        style={{ background: `linear-gradient(135deg, ${levelColor(participant.level)}, #333)` }}
      >
        {participant.avatar_url ? (
          <img src={participant.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          (participant.display_name || participant.nickname || "?")[0].toUpperCase()
        )}
        <span
          className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2"
          style={{ background: online ? "#4ade80" : "#6b7280", borderColor: "#111" }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white truncate">
          {participant.display_name || participant.nickname}
          {isMe && <span className="ml-1" style={{ color: "#555" }}>(вы)</span>}
        </p>
        <p className="text-[10px] truncate" style={{ color: "#555" }}>@{participant.nickname}</p>
      </div>

      <span className="text-xs font-mono font-bold" style={{ color: "#FFD600" }}>{participant.pts}</span>
    </div>
  );
}

// ─── QueueProgress ────────────────────────────────────────────────────────────

function QueueProgress({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1.5" style={{ color: "#888" }}>
        <span>Игроков в очереди</span>
        <span className="font-mono font-bold text-white">{current}/{total}</span>
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: pct >= 100 ? "#4ade80" : "#FFD600" }}
        />
      </div>
      <div className="flex gap-1.5 mt-2 justify-center">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="h-1.5 w-6 rounded-full transition-all duration-500"
            style={{
              background: i < current
                ? (pct >= 100 ? "#4ade80" : "#FFD600")
                : "rgba(255,255,255,0.08)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

function ChatPanel({ messages, myUserId, onSend }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b text-xs font-semibold uppercase tracking-widest"
        style={{ borderColor: "rgba(255,214,0,0.15)", color: "#FFD600" }}>
        Чат
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-xs text-center pt-4" style={{ color: "#444" }}>Пока тихо…</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.user_id === myUserId ? "items-end" : "items-start"}`}>
            <span className="text-[10px] mb-0.5" style={{ color: "#555" }}>
              {msg.user_id === myUserId ? "вы" : msg.display_name || msg.nickname}
            </span>
            <div
              className="rounded-xl px-3 py-1.5 text-xs max-w-[85%] break-words"
              style={{
                background: msg.user_id === myUserId ? "#FFD600" : "rgba(255,255,255,0.06)",
                color: msg.user_id === myUserId ? "#000" : "#e2e8f0",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2 px-3 py-2 border-t"
        style={{ borderColor: "rgba(255,214,0,0.1)" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Написать…"
          maxLength={500}
          className="flex-1 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
          style={{ background: "rgba(255,255,255,0.05)" }}
          onFocus={e => e.target.style.outline = "1px solid #FFD600"}
          onBlur={e => e.target.style.outline = "none"}
        />
        <button
          type="submit"
          className="rounded-lg px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-80"
          style={{ background: "#FFD600", color: "#000" }}
        >
          ↑
        </button>
      </form>
    </div>
  );
}

// ─── MatchArena ───────────────────────────────────────────────────────────────

function MatchArena({ activeMatch, myUserId, onNavigateTask, onReset, onSelectUser }) {
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [onlineIds, setOnlineIds] = useState([]);
  const wsRef = useRef(null);
  const [secondsRemaining, setSecondsRemaining] = useState(null);

  useEffect(() => {
    if (!activeMatch?.ends_at) return;
    const deadline = new Date(activeMatch.ends_at).getTime();
    setSecondsRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    const id = setInterval(() => {
      setSecondsRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [activeMatch?.ends_at]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token || !activeMatch?.match_id) return;

    const ws = new WebSocket(getMatchRoomSocketUrl(activeMatch.match_id, token));
    wsRef.current = ws;

    ws.addEventListener("message", (e) => {
      const payload = JSON.parse(e.data);
      const data = payload.data ?? {};
      if (payload.event === "room_state") {
        setParticipants(data.participants ?? []);
        setOnlineIds(data.online ?? []);
      }
      if (payload.event === "user_joined") setOnlineIds(data.online ?? []);
      if (payload.event === "user_left") setOnlineIds(data.online ?? []);
      if (payload.event === "chat") setMessages((prev) => [...prev, data]);
    });

    return () => ws.close();
  }, [activeMatch?.match_id]);

  function sendChat(text) {
    wsRef.current?.send(JSON.stringify({ event: "chat", text }));
    setMessages((prev) => [...prev, { user_id: myUserId, text, display_name: "вы", nickname: "вы" }]);
  }

  return (
    <div className="flex gap-4 h-full min-h-0">
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Матч найден</h2>
            <p className="text-xs" style={{ color: "#888" }}>
              До конца: <span className="font-mono font-bold" style={{ color: "#FFD600" }}>{formatCountdown(secondsRemaining)}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onNavigateTask(activeMatch.task_id)}
              className="rounded-lg px-4 py-2 text-sm font-bold transition-opacity hover:opacity-80"
              style={{ background: "#FFD600", color: "#000" }}
            >
              Открыть задачу →
            </button>
            <button
              onClick={onReset}
              className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", color: "#888" }}
            >
              Выйти
            </button>
          </div>
        </div>

        <div className="flex-1 rounded-xl border min-h-0"
          style={{ height: "360px", borderColor: "rgba(255,214,0,0.15)", background: "#111" }}>
          <ChatPanel messages={messages} myUserId={myUserId} onSend={sendChat} />
        </div>
      </div>

      <div className="w-52 shrink-0">
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "rgba(255,214,0,0.15)", background: "#111" }}>
          <div className="px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-widest"
            style={{ borderColor: "rgba(255,214,0,0.1)", color: "#FFD600" }}>
            Участники — {participants.length}
          </div>
          <div className="py-1">
            {participants.map((p) => (
              <ParticipantRow
                key={p.user_id}
                participant={p}
                online={onlineIds.includes(p.user_id)}
                isMe={p.user_id === myUserId}
                onClick={onSelectUser}
              />
            ))}
            {participants.length === 0 && (
              <p className="text-xs px-3 py-3" style={{ color: "#444" }}>Загрузка…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MatchmakingPage() {
  const navigate = useNavigate();
  const [activeMatch, setActiveMatch] = useState(null);
  const [queueInfo, setQueueInfo] = useState({ queue_size: 0, queue_position: null, total: 2 });
  const [searching, setSearching] = useState(false);
  const [statusNote, setStatusNote] = useState("Нажмите кнопку, чтобы встать в очередь.");
  const [error, setError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [teamCurrent, setTeamCurrent] = useState(null);
  const isMobile = useMediaQuery("(max-width: 767px)");

  const myUserId = useMemo(() => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.sub_id ?? payload.user_id ?? null;
    } catch {
      return null;
    }
  }, []);

  const state = useMemo(() => {
    if (activeMatch) return "matched";
    if (searching) return "searching";
    return "idle";
  }, [activeMatch, searching]);

  function handleFindMatch() {
    if (state === "searching") return;
    setError("");
    setSearching(true);
    setStatusNote("Ищем соперника с близким PTS…");

    (async () => {
      try {
        const res = await apiFetch("/matchmaking/queue", { method: "POST" });
        if (res.status === "matched") { setActiveMatch(res); setSearching(false); return; }
        if (res.status === "already_in_match") { setActiveMatch(res); setSearching(false); return; }
        if (res.status === "queued") {
          setQueueInfo({ queue_size: res.queue_size ?? 1, queue_position: res.queue_position ?? null, total: 2 });
          setStatusNote("Вы в очереди. Ожидаем соперника…");
          return;
        }
        setError(res.message || "Ошибка матчмейкинга");
        setSearching(false);
      } catch (e) {
        setError(e?.message || "Ошибка матчмейкинга");
        setSearching(false);
      }
    })();
  }

  function handleReset() {
    setError("");
    (async () => {
      try { await apiFetch("/matchmaking/queue", { method: "DELETE" }); } catch {}
      finally {
        setActiveMatch(null);
        setSearching(false);
        setQueueInfo({ queue_size: 0, queue_position: null, total: 2 });
        setStatusNote("Поиск отменён.");
      }
    })();
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const current = await apiFetch("/matchmaking/active");
        if (!mounted) return;
        if (current) { setActiveMatch(current); setSearching(false); }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

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
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    const ws = new WebSocket(getMatchmakingSocketUrl(token));

    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.event === "queue_update") {
        const data = payload.data ?? {};
        setQueueInfo({ queue_size: data.queue_size ?? 0, queue_position: data.queue_position ?? null, total: data.total ?? 2 });
        setSearching(data.status === "queued");
      }
      if (payload.event === "active_match" || payload.event === "match_found") {
        const data = payload.data ?? {};
        setActiveMatch((prev) => ({ ...(prev ?? {}), ...data }));
        setSearching(false);
        setStatusNote("Соперник найден!");
      }
    });

    return () => ws.close();
  }, []);

  if (isMobile) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight" style={{ color: "#FFD600" }}>
            PvP матчмейкинг
          </h1>
          <p className="mt-2 text-sm" style={{ color: "#666" }}>
            Система подберёт соперника с близким PTS и запустит таймер матча
          </p>
        </div>

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
                onClick={() => navigate("/team")}
                className="rounded-2xl bg-yellow-400 px-4 py-2 text-sm font-semibold text-slate-950"
              >
                Перейти в команду
              </button>
            </div>
          </div>
        ) : null}

        {state === "matched" && (
          <div style={{ height: "520px" }}>
            <MatchArena
              activeMatch={activeMatch}
              myUserId={myUserId}
              onNavigateTask={(taskId) => navigate(`/tasks/${taskId}/solve`)}
              onReset={handleReset}
              onSelectUser={setSelectedUserId}
            />
          </div>
        )}

        {state !== "matched" && (
          <div
            className="rounded-2xl border p-8 sm:p-12 flex flex-col items-center gap-8"
            style={{ borderColor: "rgba(255,214,0,0.15)", background: "#111" }}
          >
            <div
              className="flex h-28 w-28 items-center justify-center rounded-full border-2 transition-all duration-500"
              style={{
                borderColor: state === "searching" ? "#FFD600" : "rgba(255,214,0,0.2)",
                background: state === "searching" ? "rgba(255,214,0,0.05)" : "rgba(255,255,255,0.02)",
                animation: state === "searching" ? "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" : "none",
              }}
            >
              {state === "searching" && (
                <span
                  className="h-10 w-10 rounded-full border-2"
                  style={{ borderColor: "#FFD600 transparent transparent transparent", animation: "spin 1s linear infinite" }}
                />
              )}
              {state === "idle" && <span className="text-3xl">⚔️</span>}
            </div>

            <div className="text-center w-full max-w-xs">
              {state === "idle" && (
                <>
                  <p className="text-lg font-semibold text-white">Готов к бою?</p>
                  <p className="mt-1 text-sm" style={{ color: "#666" }}>Нажми и встань в очередь</p>
                </>
              )}
              {state === "searching" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-base font-semibold" style={{ color: "#FFD600" }}>Поиск соперника…</p>
                    <p className="text-xs mt-1" style={{ color: "#666" }}>
                      Позиция в очереди: {queueInfo.queue_position ?? "—"}
                    </p>
                  </div>
                  <QueueProgress
                    current={Math.min(queueInfo.queue_size, queueInfo.total)}
                    total={queueInfo.total}
                  />
                </div>
              )}
            </div>

            <div className="flex w-full max-w-xs flex-col gap-3">
              {state === "idle" && (
                <button
                  type="button"
                  onClick={handleFindMatch}
                  className="w-full rounded-xl py-3.5 text-sm font-bold transition-opacity hover:opacity-80"
                  style={{ background: "#FFD600", color: "#000" }}
                >
                  Найти матч
                </button>
              )}
              {state === "searching" && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full rounded-xl py-3.5 text-sm font-semibold transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#888" }}
                >
                  Отменить поиск
                </button>
              )}
            </div>

            <p className="text-xs" style={{ color: "#444" }}>{statusNote}</p>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        )}
      </div>

      <MiniProfile userId={selectedUserId} onClose={() => setSelectedUserId(null)} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
      `}</style>
    </div>
  );
}
